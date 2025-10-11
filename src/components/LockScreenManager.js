import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  BackHandler,
  NativeModules,
  AppState,
  DeviceEventEmitter,
  LogBox,
  NativeEventEmitter,
} from 'react-native';
import LockScreen from './LockScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
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
  isAppLockMode = false, // New prop to indicate if we're in AppLock app mode
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

  useEffect(() => {
    console.log('🔧 LockScreenManager mounted - isAppLockMode:', isAppLockMode);
    initializeLockScreenManager();

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
    };
  }, [isAppLockMode]);

  const initializeLockScreenManager = () => {
    if (hasInitialized.current) return;

    console.log(
      '🚀 Initializing LockScreenManager - forceLockScreen:',
      forceLockScreen,
    );

    // Set up event listeners
    const lockedSubscription = eventEmitter.addListener(
      'onAppLocked',
      handleLockedEvent,
    );

    const deviceEventSubscription = DeviceEventEmitter.addListener(
      'onAppLocked',
      handleLockedEvent,
    );

    // Handle initial locked app if provided
    if (forceLockScreen && initialLockedApp) {
      console.log(
        '🚨 Handling initial locked app:',
        initialLockedApp.packageName,
      );
      processLockEvent(initialLockedApp);
    } else {
      // Check for any pending locked apps only if not in AppLock mode
      if (!isAppLockMode) {
        checkPendingLockedApp();
      }
    }

    checkAccessibilityService();
    hasInitialized.current = true;

    // Cleanup on unmount
    return () => {
      lockedSubscription.remove();
      deviceEventSubscription.remove();
    };
  };

  const handleAppStateChange = nextAppState => {
    console.log(
      '📱 App State Changed:',
      appStateRef.current,
      '->',
      nextAppState,
    );

    if (nextAppState === 'background') {
      console.log('📱 App went to background');
      setIsUnlocking(false);
      lastProcessedPackage.current = null;
      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);
    } else if (nextAppState === 'active') {
      console.log('📱 App became active');
      checkAccessibilityService();

      // Process any queued events
      processNextQueuedEvent();

      // Check for pending locked apps if not showing lock screen and not in AppLock mode
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

    // If we're in AppLock mode, ignore new lock events (we're already handling one)
    if (isAppLockMode && showLockScreen) {
      console.log(
        '⏭️ Ignoring lock event - already in AppLock mode with active lock screen',
      );
      return;
    }

    // Add to queue and process
    eventQueue.current.push(event);
    processNextQueuedEvent();
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
      eventQueue.current.unshift(event); // Put back at front of queue
      return;
    }

    const {packageName, className, timestamp} = event;

    if (!packageName) {
      console.log('❌ No package name in event');
      isProcessingEvent.current = false;
      processNextQueuedEvent();
      return;
    }

    // Skip if this is the same app we just processed
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

    // Bring app to front and mark event as processed
    setTimeout(() => {
      console.log('🚀 Bringing app to front');
      AppLockModule.bringToFront();
      isProcessingEvent.current = false;

      // Process next event in queue
      processNextQueuedEvent();
    }, 50);
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

        // Reset last processed package
        lastProcessedPackage.current = null;

        // Temporarily unlock the app
        if (
          AppLockModule &&
          typeof AppLockModule.temporarilyUnlockApp === 'function'
        ) {
          await AppLockModule.temporarilyUnlockApp(currentApp.packageName);
        }

        if (currentApp.packageName === OUR_APP_PACKAGE) {
          console.log('🏠 Unlocking our own app');
          closeLockScreen();

          // If we're in AppLock mode, we need to navigate to home
          if (isAppLockMode) {
            // We'll let the App component handle the navigation
            console.log('🔄 In AppLock mode, unlock complete');
          }
        } else {
          console.log('🚀 Launching original app:', currentApp.packageName);
          if (AppLockModule && typeof AppLockModule.launchApp === 'function') {
            unlockTimeoutRef.current = setTimeout(async () => {
              try {
                await AppLockModule.launchApp(currentApp.packageName);
                console.log('✅ App launch completed');
                closeLockScreen();
              } catch (error) {
                console.error('❌ Error launching app:', error);
                closeLockScreen();
              }
            }, 300);
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
    }
  };

  const closeLockScreen = () => {
    console.log('🚪 Closing lock screen');
    setShowLockScreen(false);
    setCurrentApp(null);
    setIsUnlocking(false);
    lastProcessedPackage.current = null;

    // Clear pending state
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
    try {
      const securityQuestion = await AsyncStorage.getItem('security_question');
      const securityAnswer = await AsyncStorage.getItem('security_answer');

      if (securityQuestion && securityAnswer) {
        closeLockScreen();
        if (onForgotPin) onForgotPin();
      } else {
        showAlert(
          t('alerts.reset_pin'),
          t('forgot_pin.reset_warning'),
          'warning',
          [
            {text: t('common.cancel'), style: 'cancel'},
            {
              text: t('alerts.reset'),
              onPress: async () => {
                try {
                  closeLockScreen();
                  if (onForgotPin) onForgotPin();
                } catch (error) {
                  console.error('Error in reset confirmation:', error);
                  showAlert(
                    t('alerts.error'),
                    t('errors.reset_failed'),
                    'error',
                  );
                }
              },
              style: 'destructive',
            },
          ],
        );
      }
    } catch (error) {
      console.error('Error checking security question:', error);
    }
  };

  // If we're in AppLock mode and showing lock screen, don't render children
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
        />
      </View>
    );
  }

  // Normal mode - render children with lock screen overlay
  return (
    <View style={{flex: 1}}>
      {/* Main app content - completely hidden when lock screen is visible */}
      <View style={{flex: 1, display: showLockScreen ? 'none' : 'flex'}}>
        {children}
      </View>

      {/* Lock Screen - always on top when visible */}
      <LockScreen
        visible={showLockScreen}
        appInfo={currentApp}
        onUnlock={handleUnlock}
        onClose={closeLockScreen}
        onForgotPin={handleForgotPin}
      />
    </View>
  );
};

export default LockScreenManager;
