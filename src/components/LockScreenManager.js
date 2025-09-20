import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  BackHandler,
  Alert,
  NativeEventEmitter,
  NativeModules,
  AppState,
  DeviceEventEmitter,
  LogBox,
} from 'react-native';
import LockScreen from './LockScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {AppLockModule, PermissionModule} = NativeModules;
const appLockEventEmitter = new NativeEventEmitter(AppLockModule);

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const LockScreenManager = ({children}) => {
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [lockedApps, setLockedApps] = useState([]);
  const [appState, setAppState] = useState(AppState.currentState);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    console.log('LockScreenManager mounted');
    loadLockedApps();

    const subscription = appLockEventEmitter.addListener(
      'onAppOpened',
      event => {
        console.log('App opened event received:', event);
        const {packageName, className} = event;

        // Check if this app is locked
        const isLocked = lockedApps.some(
          app => app.packageName === packageName,
        );

        if (isLocked) {
          const appInfo = lockedApps.find(
            app => app.packageName === packageName,
          );
          console.log('Locked app detected:', appInfo);
          setCurrentApp(appInfo);
          setShowLockScreen(true);

          // Always try to bring our app to foreground when a locked app is opened
          setTimeout(() => {
            NativeModules.AppLockModule.bringToFront();
          }, 100);
        }
      },
    );

    // Listen for app state changes
    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        console.log(
          'App state changed from',
          appStateRef.current,
          'to',
          nextAppState,
        );
        setAppState(nextAppState);
        appStateRef.current = nextAppState;

        // When app comes to foreground, check if accessibility service is running
        if (nextAppState === 'active') {
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
          return true; // Prevent default behavior
        }
        return false;
      },
    );

    return () => {
      console.log('LockScreenManager unmounted');
      subscription.remove();
      appStateSubscription.remove();
      backHandler.remove();
    };
  }, [lockedApps, showLockScreen]);

  const checkAccessibilityService = async () => {
    try {
      const isRunning = await AppLockModule.isAccessibilityServiceRunning();
      console.log('Accessibility service running:', isRunning);

      if (!isRunning) {
        Alert.alert(
          'Accessibility Service Required',
          'Please enable the accessibility service for App Lock in Settings > Accessibility to lock apps properly.',
          [
            {
              text: 'Open Settings',
              onPress: () => PermissionModule.openAccessibilitySettings(),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ],
        );
      }
    } catch (error) {
      console.error('Error checking accessibility service:', error);
    }
  };

  const loadLockedApps = async () => {
    try {
      const savedLockedApps = await AsyncStorage.getItem('lockedApps');
      if (savedLockedApps) {
        const apps = JSON.parse(savedLockedApps);
        setLockedApps(apps);
        console.log('Loaded locked apps:', apps);
      }
    } catch (error) {
      console.error('Error loading locked apps:', error);
    }
  };

  const handleUnlock = () => {
    // App unlocked successfully
    console.log('App unlocked:', currentApp?.name);
    setShowLockScreen(false);
    setCurrentApp(null);
  };

  const handleClose = () => {
    setShowLockScreen(false);
    setCurrentApp(null);
  };

  const handleForgotPin = async () => {
    Alert.alert(
      'Reset PIN',
      'This will require you to set up a new PIN. All your locked apps will be unlocked.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('applock_pin');
              await AsyncStorage.removeItem('lockedApps');
              setLockedApps([]);
              Alert.alert(
                'Success',
                'PIN has been reset. Please set up a new PIN.',
              );
            } catch (error) {
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
