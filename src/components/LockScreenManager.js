import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  BackHandler,
  Alert,
  NativeModules,
  AppState,
  DeviceEventEmitter,
  LogBox,
  NativeEventEmitter,
} from 'react-native';
import LockScreen from './LockScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {AppLockModule, PermissionModule} = NativeModules;

// Create event emitter
const eventEmitter = new NativeEventEmitter(AppLockModule);

// Ignore specific warnings
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
}) => {
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [lockedApps, setLockedApps] = useState([]);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isAppActive, setIsAppActive] = useState(true);
  const appStateRef = useRef(AppState.currentState);
  const hasCheckedPendingApp = useRef(false);
  const hasHandledInitialApp = useRef(false);

  useEffect(() => {
    console.log('🔧 LockScreenManager mounted');
    console.log('📦 Initial locked app:', initialLockedApp);
    console.log('🔒 Force lock screen:', forceLockScreen);

    // Load initial data
    loadLockedApps();
    checkAllPermissions();

    // Handle initial locked app if provided
    if (initialLockedApp && !hasHandledInitialApp.current) {
      console.log(
        '🚨 Handling initial locked app:',
        initialLockedApp.packageName,
      );
      handleLockedEvent(initialLockedApp);
      hasHandledInitialApp.current = true;
      hasCheckedPendingApp.current = true;
    } else {
      // Check for pending locked app when component mounts
      checkPendingLockedApp();
    }

    // Listen for app locked events from native side using NativeEventEmitter
    const lockedSubscription = eventEmitter.addListener(
      'onAppLocked',
      event => {
        handleLockedEvent(event);
      },
    );

    // Also listen via DeviceEventEmitter as backup
    const deviceEventSubscription = DeviceEventEmitter.addListener(
      'onAppLocked',
      event => {
        handleLockedEvent(event);
      },
    );

    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        console.log(
          '📱 App State Changed:',
          appStateRef.current,
          '->',
          nextAppState,
        );

        setIsAppActive(nextAppState === 'active');

        // Reset unlocking state when app goes to background
        if (nextAppState === 'background') {
          console.log('📱 App went to background, resetting unlock state');
          setIsUnlocking(false);
        }

        appStateRef.current = nextAppState;

        if (nextAppState === 'active') {
          console.log(
            '🔄 App is active, checking permissions and pending apps',
          );
          checkAccessibilityService();

          // Only check for pending apps if not already handled
          if (!hasCheckedPendingApp.current && !hasHandledInitialApp.current) {
            checkPendingLockedApp();
          }
        }
      },
    );

    // Check accessibility service on mount
    checkAccessibilityService();

    // Prevent back button from closing the lock screen
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (showLockScreen) {
          console.log('🔒 Back button blocked - Lock screen active');
          return true; // Prevent default behavior
        }
        return false;
      },
    );

    return () => {
      console.log('🧹 LockScreenManager unmounted - Cleaning up');
      lockedSubscription.remove();
      deviceEventSubscription.remove();
      appStateSubscription.remove();
      backHandler.remove();
    };
  }, [isUnlocking, showLockScreen, initialLockedApp, forceLockScreen]);

  const checkPendingLockedApp = async () => {
    if (hasCheckedPendingApp.current) {
      console.log('⏭️ Already checked for pending app, skipping');
      return;
    }

    try {
      console.log('🔍 Checking for pending locked app...');

      // First, check if the method exists
      if (
        AppLockModule &&
        typeof AppLockModule.getPendingLockedApp === 'function'
      ) {
        const pendingApp = await AppLockModule.getPendingLockedApp();

        if (pendingApp && pendingApp.packageName) {
          console.log('🚨 Found pending locked app:', pendingApp.packageName);
          handleLockedEvent(pendingApp);
          hasCheckedPendingApp.current = true;
        } else {
          console.log('📭 No pending locked app found');
          hasCheckedPendingApp.current = true;
        }
      } else {
        console.log(
          '⚠️ getPendingLockedApp method not available, using event emitter only',
        );
        hasCheckedPendingApp.current = true;
      }
    } catch (error) {
      console.error('❌ Error checking pending locked app:', error);
      hasCheckedPendingApp.current = true;
    }
  };

  const handleLockedEvent = event => {
    // Prevent showing lock screen if we're currently in the process of unlocking
    if (isUnlocking) {
      console.log('⏳ Currently unlocking, ignoring lock event');
      return;
    }

    console.log('🎯 Lock Event Received:', JSON.stringify(event, null, 2));

    const {packageName, className, timestamp} = event;

    if (packageName && packageName !== OUR_APP_PACKAGE) {
      console.log('🚨 Showing Lock Screen for:', packageName);

      const appInfo = {
        packageName: packageName,
        className: className,
        name: getAppName(packageName),
        icon: null,
        timestamp: timestamp || Date.now().toString(),
      };

      setCurrentApp(appInfo);
      setShowLockScreen(true);

      // Ensure our app is in foreground and focused
      console.log('🚀 Bringing app to front immediately');
      AppLockModule.bringToFront();
    }
  };

  useEffect(() => {
    console.log('🔒 Lock Screen State Changed:', showLockScreen);
    console.log('📱 Current App:', currentApp);
    console.log('🔓 Unlocking State:', isUnlocking);
    console.log('📱 App Active State:', isAppActive);

    // If forceLockScreen is true and we have an initial app, ensure lock screen is shown
    if (
      forceLockScreen &&
      initialLockedApp &&
      !showLockScreen &&
      !hasHandledInitialApp.current
    ) {
      console.log('🔒 Forcing lock screen display');
      handleLockedEvent(initialLockedApp);
      hasHandledInitialApp.current = true;
    }
  }, [
    showLockScreen,
    currentApp,
    isUnlocking,
    isAppActive,
    forceLockScreen,
    initialLockedApp,
  ]);

  const getAppName = packageName => {
    // Extract app name from package name
    const parts = packageName.split('.');
    const lastPart = parts[parts.length - 1];
    // Capitalize first letter
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  };

  const checkAllPermissions = async () => {
    try {
      console.log('🔍 Checking all permissions...');

      const accessibility =
        await PermissionModule.getAccessibilityServiceStatus();
      const overlay = await PermissionModule.isOverlayPermissionGranted();
      const usage = await PermissionModule.isUsageAccessGranted();

      console.log('📋 Permission Status:');
      console.log('   ♿ Accessibility:', accessibility);
      console.log('   🪟 Overlay:', overlay);
      console.log('   📊 Usage Access:', usage);

      if (!accessibility) {
        console.warn('⚠️ Accessibility service is not enabled');
      }
      if (!overlay) {
        console.warn('⚠️ Overlay permission is not granted');
      }
      if (!usage) {
        console.warn('⚠️ Usage access permission is not granted');
      }
    } catch (error) {
      console.error('❌ Error checking permissions:', error);
    }
  };

  const checkAccessibilityService = async () => {
    try {
      console.log('🔍 Checking accessibility service status...');
      const isRunning = await AppLockModule.isAccessibilityServiceRunning();
      console.log('♿ Accessibility Service Running:', isRunning);

      if (!isRunning) {
        console.warn('⚠️ Accessibility service is NOT running');
        if (!showLockScreen) {
          Alert.alert(
            'Accessibility Service Required',
            'Please enable the accessibility service for App Lock in Settings > Accessibility to lock apps properly.',
            [
              {
                text: 'Open Settings',
                onPress: () => {
                  console.log('⚙️ Opening accessibility settings');
                  PermissionModule.openAccessibilitySettings();
                },
              },
              {
                text: 'Cancel',
                style: 'cancel',
              },
            ],
          );
        }
      } else {
        console.log('✅ Accessibility service is running properly');
      }
    } catch (error) {
      console.error('❌ Error checking accessibility service:', error);
    }
  };

  const loadLockedApps = async () => {
    try {
      console.log('📦 HomeScreen: Loading locked apps');
      const savedLockedApps = await AsyncStorage.getItem('lockedApps');
      let lockedSet = new Set();

      if (savedLockedApps) {
        let lockedAppsArray;
        try {
          lockedAppsArray = JSON.parse(savedLockedApps);
          console.log('📋 Raw locked apps from storage:', lockedAppsArray);
        } catch (e) {
          console.error('❌ Error parsing locked apps:', e);
          await AsyncStorage.removeItem('lockedApps');
          lockedAppsArray = [];
        }

        if (Array.isArray(lockedAppsArray) && lockedAppsArray.length > 0) {
          lockedAppsArray.forEach(item => {
            let packageName;
            if (typeof item === 'string') {
              packageName = item;
            } else if (typeof item === 'object' && item.packageName) {
              packageName = item.packageName;
            }

            if (packageName && packageName !== OUR_APP_PACKAGE) {
              lockedSet.add(packageName);
            }
          });
        }
      }

      console.log('🔒 Final locked apps set:', Array.from(lockedSet));
      setLockedApps(Array.from(lockedSet));

      // Update native module
      const packageNamesArray = Array.from(lockedSet);
      if (AppLockModule && typeof AppLockModule.setLockedApps === 'function') {
        await AppLockModule.setLockedApps(packageNamesArray);
      }
    } catch (error) {
      console.error('❌ HomeScreen: Error loading locked apps:', error);
    }
  };

  const handleUnlock = () => {
    console.log('✅ App unlocked:', currentApp?.name);
    setIsUnlocking(true);

    // Launch the original app instead of just closing
    if (currentApp?.packageName) {
      console.log('🚀 Launching original app:', currentApp.packageName);

      // Check if launchApp method exists
      if (AppLockModule && typeof AppLockModule.launchApp === 'function') {
        AppLockModule.launchApp(currentApp.packageName);
      } else {
        console.log('❌ launchApp not available, using closeLockScreen');
        AppLockModule.closeLockScreen();
      }
    } else {
      console.log('❌ No package name, using closeLockScreen');
      AppLockModule.closeLockScreen();
    }

    // Clear the state immediately
    setShowLockScreen(false);
    setCurrentApp(null);

    // Reset unlocking state after a delay
    setTimeout(() => {
      setIsUnlocking(false);
    }, 1000);
  };

  const handleClose = () => {
    console.log('🚪 Closing lock screen');
    setShowLockScreen(false);
    setCurrentApp(null);
    setIsUnlocking(false);
  };

  const handleForgotPin = async () => {
    try {
      const securityQuestion = await AsyncStorage.getItem('security_question');
      const securityAnswer = await AsyncStorage.getItem('security_answer');

      if (securityQuestion && securityAnswer) {
        // Close the lock screen first
        setShowLockScreen(false);
        setCurrentApp(null);
        setIsUnlocking(false);

        // Then call the parent handler to navigate
        if (onForgotPin) {
          onForgotPin();
        }
      } else {
        // Show old alert if no security question is set
        Alert.alert(
          'Reset PIN',
          'This will reset your PIN and unlock all apps. You will need to set up a new PIN.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Reset',
              onPress: async () => {
                try {
                  // Reset Keychain
                  await Keychain.resetGenericPassword({
                    service: 'applock_service',
                  });

                  // Clear locked apps
                  await AppLockModule.setLockedApps([]);

                  Alert.alert(
                    'Success',
                    'PIN has been reset. All apps are now unlocked.',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          handleClose();
                          if (onForgotPin) {
                            onForgotPin();
                          }
                        },
                      },
                    ],
                  );
                } catch (error) {
                  console.error('Error resetting PIN:', error);
                  Alert.alert('Error', 'Failed to reset PIN');
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

  return (
    <View style={{flex: 1}}>
      {children}
      <LockScreen
        visible={showLockScreen}
        appInfo={currentApp}
        onUnlock={handleUnlock}
        onClose={handleClose}
        onForgotPin={handleForgotPin}
      />
    </View>
  );
};

export default LockScreenManager;
