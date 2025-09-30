import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  BackHandler,
  Alert,
  NativeModules,
  AppState,
  DeviceEventEmitter,
  LogBox,
  Platform,
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

const LockScreenManager = ({children}) => {
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [lockedApps, setLockedApps] = useState([]);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    console.log('🔧 LockScreenManager mounted');

    // Load initial data
    loadLockedApps();
    checkAllPermissions();

    // Listen for app locked events from native side using NativeEventEmitter
    const lockedSubscription = eventEmitter.addListener(
      'onAppLocked',
      event => {
        // Prevent showing lock screen if we're currently in the process of unlocking
        if (isUnlocking) {
          console.log('⏳ Currently unlocking, ignoring lock event');
          return;
        }

        console.log(
          '🎯 onAppLocked Event Received:',
          JSON.stringify(event, null, 2),
        );

        const {packageName, className, timestamp} = event;

        if (packageName && packageName !== OUR_APP_PACKAGE) {
          console.log('🚨 Showing Lock Screen for:', packageName);

          const appInfo = {
            packageName: packageName,
            className: className,
            name: getAppName(packageName),
            icon: null,
            timestamp: timestamp,
          };

          setCurrentApp(appInfo);
          setShowLockScreen(true);

          // Bring our app to foreground
          setTimeout(() => {
            console.log('🚀 Bringing app to front');
            AppLockModule.bringToFront();
          }, 100);
        }
      },
    );

    // Also listen via DeviceEventEmitter as backup
    const deviceEventSubscription = DeviceEventEmitter.addListener(
      'onAppLocked',
      event => {
        // Prevent showing lock screen if we're currently in the process of unlocking
        if (isUnlocking) {
          console.log('⏳ Currently unlocking, ignoring lock event');
          return;
        }

        console.log('📱 DeviceEvent Received onAppLocked:', event);
        if (event.packageName && event.packageName !== OUR_APP_PACKAGE) {
          const appInfo = {
            packageName: event.packageName,
            className: event.className,
            name: getAppName(event.packageName),
            icon: null,
            timestamp: event.timestamp,
          };
          setCurrentApp(appInfo);
          setShowLockScreen(true);

          setTimeout(() => {
            AppLockModule.bringToFront();
          }, 100);
        }
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

        // Reset unlocking state when app goes to background
        if (nextAppState === 'background') {
          console.log('📱 App went to background, resetting unlock state');
          setIsUnlocking(false);
        }

        appStateRef.current = nextAppState;

        if (nextAppState === 'active') {
          console.log('🔄 App is active, checking permissions');
          checkAccessibilityService();
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
  }, [isUnlocking]);

  useEffect(() => {
    console.log('🔒 Lock Screen State Changed:', showLockScreen);
    console.log('📱 Current App:', currentApp);
    console.log('🔓 Unlocking State:', isUnlocking);
  }, [showLockScreen, currentApp, isUnlocking]);

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
      console.log('📦 Loading locked apps from storage...');
      const savedLockedApps = await AsyncStorage.getItem('lockedApps');

      if (savedLockedApps) {
        const apps = JSON.parse(savedLockedApps);
        console.log('🔒 Loaded Locked Apps:', apps);
        setLockedApps(apps);

        // Update native module with package names only
        const packageNames = Array.isArray(apps)
          ? apps.map(app => (typeof app === 'object' ? app.packageName : app))
          : [];

        console.log('📋 Sending to native module:', packageNames);
        await AppLockModule.setLockedApps(packageNames);
      } else {
        console.log('📭 No locked apps found in storage');
        setLockedApps([]);
      }
    } catch (error) {
      console.error('❌ Error loading locked apps:', error);
    }
  };
  const handleUnlock = () => {
    console.log('✅ App unlocked:', currentApp?.name);

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
  };

  const handleClose = () => {
    console.log('🚪 Closing lock screen');
    setShowLockScreen(false);
    setCurrentApp(null);
    setIsUnlocking(false);
  };

  const handleForgotPin = async () => {
    console.log('🔑 Forgot PIN flow started');
    Alert.alert(
      'Reset PIN',
      'This will require you to set up a new PIN. All your locked apps will be unlocked.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('❌ PIN reset cancelled'),
        },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              console.log('🔄 Resetting PIN and locked apps...');
              await AsyncStorage.removeItem('applock_pin');
              await AsyncStorage.removeItem('lockedApps');
              setLockedApps([]);
              await AppLockModule.setLockedApps([]);
              setShowLockScreen(false);
              setCurrentApp(null);
              setIsUnlocking(false);
              Alert.alert(
                'Success',
                'PIN has been reset. Please set up a new PIN.',
              );
            } catch (error) {
              console.error('❌ Error resetting PIN:', error);
              Alert.alert('Error', 'Failed to reset PIN');
            }
          },
          style: 'destructive',
        },
      ],
    );
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
