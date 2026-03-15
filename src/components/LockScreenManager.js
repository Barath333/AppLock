import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  BackHandler,
  NativeModules,
  AppState,
  DeviceEventEmitter,
  LogBox,
  NativeEventEmitter,
  InteractionManager,
} from 'react-native';
import LockScreen from './LockScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTranslation} from 'react-i18next';
import {useAlert} from '../contexts/AlertContext';

const {AppLockModule, PermissionModule} = NativeModules;

const eventEmitter = new NativeEventEmitter(AppLockModule);

LogBox.ignoreLogs([
  'new NativeEventEmitter',
  'Non-serializable values were found in the navigation state',
]);

const OUR_APP_PACKAGE = 'com.applock';

const LockScreenManager = ({
  children,
  initialLockedApp,
  forceLockScreen = false,
  onForgotPin,
  onResetToSetup,
  isAppLockMode = false,
  onUnlock,
}) => {
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const hasInitialized = useRef(false);
  const unlockTimeoutRef = useRef(null);
  const lastProcessedPackage = useRef(null);
  const eventQueue = useRef([]);
  const isProcessingEvent = useRef(false);
  const lastEventTime = useRef(0);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  // NEW: Cooldown map to ignore lock events immediately after unlock (per package)
  const unlockCooldown = useRef(new Map()); // packageName -> expiry timestamp
  // NEW: Package cooldown for JS side to prevent duplicate events
  const packageCooldown = useRef(new Map()); // packageName -> expiry

  const checkBiometricsStatus = async () => {
    try {
      const enabled = await AsyncStorage.getItem('biometrics_enabled');
      setBiometricsEnabled(enabled === 'true');
      console.log('🔐 Biometrics enabled status:', enabled === 'true');
    } catch (error) {
      console.error('Error checking biometrics status:', error);
      setBiometricsEnabled(false);
    }
  };

  useEffect(() => {
    console.log('🔧 LockScreenManager mounted - isAppLockMode:', isAppLockMode);
    initializeLockScreenManager();
    checkBiometricsStatus();

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    return () => {
      console.log('🧹 LockScreenManager unmounted');
      appStateSubscription.remove();
      backHandler.remove();
      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);

      // Clear any session unlocks when component unmounts
      if (AppLockModule && typeof AppLockModule.clearSessionUnlocks === 'function') {
        AppLockModule.clearSessionUnlocks();
      }
    };
  }, [isAppLockMode]);

  const initializeLockScreenManager = () => {
    if (hasInitialized.current) return;

    console.log(
      '🚀 Initializing LockScreenManager - forceLockScreen:',
      forceLockScreen,
    );

    const lockedSubscription = eventEmitter.addListener(
      'onAppLocked',
      handleLockedEvent,
    );

    const deviceEventSubscription = DeviceEventEmitter.addListener(
      'onAppLocked',
      handleLockedEvent,
    );

    if (forceLockScreen && initialLockedApp) {
      console.log(
        '🚨 Handling initial locked app (deferred):',
        initialLockedApp.packageName,
      );
      InteractionManager.runAfterInteractions(() => {
        processLockEvent(initialLockedApp);
      });
    } else {
      if (!isAppLockMode) {
        checkPendingLockedApp();
      }
    }

    checkAccessibilityService();
    hasInitialized.current = true;

    return () => {
      lockedSubscription.remove();
      deviceEventSubscription.remove();
    };
  };

  const handleAppStateChange = nextAppState => {
    console.log('📱 App State Changed:', appStateRef.current, '->', nextAppState);

    if (nextAppState === 'background') {
      console.log('📱 App went to background');
      setIsUnlocking(false);
      lastProcessedPackage.current = null;
      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);
      unlockCooldown.current.clear(); // Clear cooldowns
      packageCooldown.current.clear(); // Clear JS package cooldowns
    } else if (nextAppState === 'active') {
      console.log('📱 App became active');
      checkAccessibilityService();
      checkBiometricsStatus();
      processNextQueuedEvent();
      if (!showLockScreen && !isAppLockMode) {
        checkPendingLockedApp();
      }
    }

    appStateRef.current = nextAppState;
  };

  const handleBackPress = () => {
    if (showLockScreen) {
      console.log('🔒 Back button blocked - Lock screen active');
      return true;
    }
    return false;
  };

  const checkPendingLockedApp = async () => {
    try {
      console.log('🔍 Checking for pending locked app...');
      if (
        AppLockModule &&
        typeof AppLockModule.getPendingLockedApp === 'function'
      ) {
        const pendingApp = await AppLockModule.getPendingLockedApp();
        if (pendingApp && pendingApp.packageName) {
          console.log('🚨 Found pending locked app:', pendingApp.packageName);
          processLockEvent(pendingApp);
        } else {
          console.log('📭 No pending locked app found');
        }
      }
    } catch (error) {
      console.error('❌ Error checking pending locked app:', error);
    }
  };

  const handleLockedEvent = event => {
    console.log('🎯 Lock Event Received:', event.packageName);

    const currentTime = Date.now();
    if (currentTime - lastEventTime.current < 500) {
      console.log('⏭️ Event rate limited, skipping');
      return;
    }
    lastEventTime.current = currentTime;

    // NEW: JS per-package cooldown
    const cooldownExpiry = packageCooldown.current.get(event.packageName);
    if (cooldownExpiry && currentTime < cooldownExpiry) {
      console.log(`⏭️ Ignoring event for ${event.packageName} (JS cooldown active)`);
      return;
    }
    // Set cooldown for this package (2 seconds)
    packageCooldown.current.set(event.packageName, currentTime + 2000);

    if (event.packageName === lastProcessedPackage.current) {
      console.log('⏭️ Skipping duplicate event for:', event.packageName);
      return;
    }

    if (event.packageName === OUR_APP_PACKAGE) {
      console.log('🏠 Lock event for our own app');
      if (isAppLockMode && showLockScreen) {
        console.log('⏭️ Already in lock screen mode for our app, ignoring');
        return;
      }

      const checkSecurityAndProcess = async () => {
        try {
          const securityQuestion = await AsyncStorage.getItem('security_question');
          if (!securityQuestion) {
            console.log('⏭️ No security question, ignoring lock event');
            return;
          }
          processLockEvent(event);
        } catch (error) {
          console.error('Error checking security:', error);
          processLockEvent(event);
        }
      };

      checkSecurityAndProcess();
      return;
    }

    processLockEvent(event);
  };

  const processNextQueuedEvent = () => {
    if (isProcessingEvent.current || eventQueue.current.length === 0) {
      return;
    }

    const event = eventQueue.current.shift();
    processLockEvent(event);
  };

  const processLockEvent = event => {
    if (isProcessingEvent.current) {
      console.log('⏳ Already processing event, queuing...');
      eventQueue.current.unshift(event);
      return;
    }

    const {packageName, className, timestamp} = event;

    if (!packageName) {
      console.log('❌ No package name in event');
      isProcessingEvent.current = false;
      processNextQueuedEvent();
      return;
    }

    // Cooldown check (unlock cooldown)
    const cooldownExpiry = unlockCooldown.current.get(packageName);
    if (cooldownExpiry && Date.now() < cooldownExpiry) {
      console.log(`⏭️ Ignoring lock event for ${packageName} (cooldown active)`);
      isProcessingEvent.current = false;
      processNextQueuedEvent();
      return;
    }

    if (packageName === lastProcessedPackage.current) {
      console.log('⏭️ Skipping duplicate event for:', packageName);
      isProcessingEvent.current = false;
      processNextQueuedEvent();
      return;
    }

    console.log('🚨 PROCESSING Lock Screen for:', packageName);
    isProcessingEvent.current = true;
    lastProcessedPackage.current = packageName;

    const appInfo = {
      packageName: packageName,
      className: className,
      name: getAppName(packageName),
      icon: null,
      timestamp: timestamp || Date.now().toString(),
    };

    setCurrentApp(appInfo);
    setShowLockScreen(true);

    // Skip bringToFront for our own app
    if (packageName !== OUR_APP_PACKAGE) {
      setTimeout(() => {
        console.log('🚀 Bringing app to front');
        AppLockModule.bringToFront();
        isProcessingEvent.current = false;
        processNextQueuedEvent();
      }, 50);
    } else {
      // For our own app, just mark processing as done after a short delay
      setTimeout(() => {
        isProcessingEvent.current = false;
        processNextQueuedEvent();
      }, 50);
    }
  };

  const getAppName = packageName => {
    if (packageName === OUR_APP_PACKAGE) return 'App Lock';
    const parts = packageName.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  };

  const checkAccessibilityService = async () => {
    try {
      const isRunning = await AppLockModule.isAccessibilityServiceRunning();
      console.log('♿ Accessibility Service Running:', isRunning);
      if (!isRunning && !showLockScreen) {
        showAlert(
          t('permissions.accessibility_required'),
          t('permissions.accessibility_description'),
          'warning',
          [
            {
              text: t('permissions.open_settings'),
              onPress: () => PermissionModule.openAccessibilitySettings(),
            },
            {text: t('common.cancel'), style: 'cancel'},
          ],
        );
      }
    } catch (error) {
      console.error('❌ Error checking accessibility service:', error);
    }
  };

  const handleUnlock = async () => {
    console.log('✅ App unlocked:', currentApp?.name);
    setIsUnlocking(true);

    try {
      if (currentApp?.packageName) {
        console.log('🚀 Handling unlock for:', currentApp.packageName);

        // Set cooldown
        unlockCooldown.current.set(currentApp.packageName, Date.now() + 2000);

        // Remove queued events for this package
        eventQueue.current = eventQueue.current.filter(
          e => e.packageName !== currentApp.packageName
        );

        lastProcessedPackage.current = null;

        if (currentApp.packageName === OUR_APP_PACKAGE) {
          console.log('🏠 Unlocking our own app - just closing lock screen');
          if (onUnlock) {
            console.log('🔄 Calling onUnlock callback to switch to normal mode');
            onUnlock();
          }
          closeLockScreen();
        } else {
          console.log('🚀 Launching original app:', currentApp.packageName);
          if (AppLockModule && typeof AppLockModule.launchApp === 'function') {
            try {
              // Attempt to launch the app
              await AppLockModule.launchApp(currentApp.packageName);
              console.log('✅ App launch completed');
              
              // Give the system a moment to bring the target app to front
              await new Promise(resolve => setTimeout(resolve, 400));
              
              // Now close the lock screen
              closeLockScreen();
            } catch (error) {
              console.error('❌ Error launching app:', error);
              // If launch fails, keep lock screen visible and show error
              setShowLockScreen(true); // Ensure it stays visible
              setIsUnlocking(false);
              // You might want to set an error state in LockScreen, but we'll just log for now
            }
          } else {
            console.log('❌ launchApp not available');
            closeLockScreen();
          }
        }
      } else {
        console.log('❌ No package name');
        closeLockScreen();
      }
    } catch (error) {
      console.error('❌ Error during unlock:', error);
      closeLockScreen();
    } finally {
      setIsUnlocking(false);
    }
  };

  const closeLockScreen = () => {
    console.log('🚪 Closing lock screen');
    setShowLockScreen(false);
    setCurrentApp(null);
    setIsUnlocking(false);
    lastProcessedPackage.current = null;
    unlockCooldown.current.clear(); // Clear all cooldowns
    packageCooldown.current.clear(); // Clear JS package cooldowns
    clearPendingLockState();
  };

  const clearPendingLockState = async () => {
    try {
      await AsyncStorage.multiRemove([
        'pendingLockedPackage',
        'pendingLockedClass',
        'pendingLockedTimestamp',
      ]);
    } catch (error) {
      console.error('Error clearing pending lock state:', error);
    }
  };

  const handleForgotPin = async () => {
    console.log('🔓 Forgot PIN clicked');
    try {
      const securityQuestion = await AsyncStorage.getItem('security_question');
      console.log('🔍 Security question exists:', !!securityQuestion);
      closeLockScreen();
      if (onForgotPin) {
        console.log('🔄 Calling onForgotPin callback');
        setTimeout(() => {
          onForgotPin();
        }, 300);
      }
    } catch (error) {
      console.error('❌ Error in handleForgotPin:', error);
      closeLockScreen();
    }
  };

  if (isAppLockMode && showLockScreen) {
    console.log('🔒 Rendering only lock screen in AppLock mode');
    return (
      <View style={{flex: 1}}>
        <LockScreen
          visible={showLockScreen}
          appInfo={currentApp}
          onUnlock={handleUnlock}
          onClose={closeLockScreen}
          onForgotPin={handleForgotPin}
          biometricsEnabled={biometricsEnabled}
        />
      </View>
    );
  }

  return (
    <View style={{flex: 1}}>
      <View style={{flex: 1, display: showLockScreen ? 'none' : 'flex'}}>
        {children}
      </View>
      <LockScreen
        visible={showLockScreen}
        appInfo={currentApp}
        onUnlock={handleUnlock}
        onClose={closeLockScreen}
        onForgotPin={handleForgotPin}
        biometricsEnabled={biometricsEnabled}
      />
    </View>
  );
};

export default LockScreenManager;