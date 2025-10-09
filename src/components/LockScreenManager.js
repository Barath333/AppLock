import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  BackHandler,
  NativeModules,
  AppState,
  DeviceEventEmitter,
  LogBox,
  NativeEventEmitter,
  StatusBar,
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
}) => {
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const hasCheckedPendingApp = useRef(false);
  const hasHandledInitialApp = useRef(false);
  const unlockTimeoutRef = useRef(null);

  useEffect(() => {
    console.log('🔧 LockScreenManager mounted');
    console.log('📦 Initial locked app:', initialLockedApp);
    console.log('🔒 Force lock screen:', forceLockScreen);

    if (forceLockScreen && initialLockedApp && !hasHandledInitialApp.current) {
      console.log(
        '🚨 Handling initial locked app:',
        initialLockedApp.packageName,
      );
      handleLockedEvent(initialLockedApp);
      hasHandledInitialApp.current = true;
    } else {
      checkPendingLockedApp();
    }

    const lockedSubscription = eventEmitter.addListener(
      'onAppLocked',
      handleLockedEvent,
    );
    const deviceEventSubscription = DeviceEventEmitter.addListener(
      'onAppLocked',
      handleLockedEvent,
    );

    const appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );

    checkAccessibilityService();

    return () => {
      console.log('🧹 LockScreenManager unmounted - Cleaning up');
      lockedSubscription.remove();
      deviceEventSubscription.remove();
      appStateSubscription.remove();
      backHandler.remove();
      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);
    };
  }, []);

  const handleAppStateChange = nextAppState => {
    console.log(
      '📱 App State Changed:',
      appStateRef.current,
      '->',
      nextAppState,
    );
    if (nextAppState === 'background') {
      console.log('📱 App went to background, resetting unlock state');
      setIsUnlocking(false);
      if (unlockTimeoutRef.current) clearTimeout(unlockTimeoutRef.current);
    }
    appStateRef.current = nextAppState;
    if (nextAppState === 'active') {
      checkAccessibilityService();
      if (!hasCheckedPendingApp.current && !hasHandledInitialApp.current) {
        checkPendingLockedApp();
      }
    }
  };

  const handleBackPress = () => {
    if (showLockScreen) {
      console.log('🔒 Back button blocked - Lock screen active');
      return true;
    }
    return false;
  };

  const checkPendingLockedApp = async () => {
    if (hasCheckedPendingApp.current) return;
    try {
      console.log('🔍 Checking for pending locked app...');
      if (
        AppLockModule &&
        typeof AppLockModule.getPendingLockedApp === 'function'
      ) {
        const pendingApp = await AppLockModule.getPendingLockedApp();
        if (pendingApp && pendingApp.packageName) {
          console.log('🚨 Found pending locked app:', pendingApp.packageName);
          handleLockedEvent(pendingApp);
        } else {
          console.log('📭 No pending locked app found');
        }
      }
      hasCheckedPendingApp.current = true;
    } catch (error) {
      console.error('❌ Error checking pending locked app:', error);
      hasCheckedPendingApp.current = true;
    }
  };

  const handleLockedEvent = event => {
    if (isUnlocking) {
      console.log('⏳ Currently unlocking, ignoring lock event');
      return;
    }

    console.log('🎯 Lock Event Received:', JSON.stringify(event, null, 2));
    const {packageName, className, timestamp} = event;

    if (packageName) {
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
      console.log('🚀 Bringing app to front immediately');
      AppLockModule.bringToFront();
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
      console.log('🔍 Checking accessibility service status...');
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

        // Always temporarily unlock the app first
        if (
          AppLockModule &&
          typeof AppLockModule.temporarilyUnlockApp === 'function'
        ) {
          console.log('🔓 Temporarily unlocking app in native module');
          await AppLockModule.temporarilyUnlockApp(currentApp.packageName);
        }

        // CRITICAL FIX: For our own app, just close the lock screen without launching anything
        if (currentApp.packageName === OUR_APP_PACKAGE) {
          console.log('🏠 Unlocking our own app - closing lock screen only');
          setShowLockScreen(false);
          setCurrentApp(null);
          setIsUnlocking(false);

          // Clear any pending lock screen state
          try {
            await AsyncStorage.multiRemove([
              'pendingLockedPackage',
              'pendingLockedClass',
              'pendingLockedTimestamp',
            ]);
          } catch (error) {
            console.error('Error clearing pending lock state:', error);
          }
        } else {
          console.log('🚀 Launching original app:', currentApp.packageName);
          if (AppLockModule && typeof AppLockModule.launchApp === 'function') {
            unlockTimeoutRef.current = setTimeout(async () => {
              try {
                await AppLockModule.launchApp(currentApp.packageName);
                console.log('✅ App launch completed');
                setShowLockScreen(false);
                setCurrentApp(null);
                setIsUnlocking(false);
              } catch (error) {
                console.error('❌ Error launching app:', error);
                setShowLockScreen(false);
                setCurrentApp(null);
                setIsUnlocking(false);
              }
            }, 300);
          } else {
            console.log('❌ launchApp not available, closing lock screen');
            setShowLockScreen(false);
            setCurrentApp(null);
            setIsUnlocking(false);
          }
        }
      } else {
        console.log('❌ No package name, closing lock screen');
        setShowLockScreen(false);
        setCurrentApp(null);
        setIsUnlocking(false);
      }
    } catch (error) {
      console.error('❌ Error during unlock:', error);
      setShowLockScreen(false);
      setCurrentApp(null);
      setIsUnlocking(false);
    }
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
        setShowLockScreen(false);
        setCurrentApp(null);
        setIsUnlocking(false);
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
                  console.log('🔄 Resetting app from LockScreenManager...');
                  await resetAppToSetup();
                } catch (error) {
                  console.error('Error resetting PIN:', error);
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

  const resetAppToSetup = async () => {
    try {
      console.log('🔄 Resetting app to setup state from LockScreenManager...');
      await Keychain.resetGenericPassword({service: 'applock_service'});
      await AsyncStorage.multiRemove([
        'setupCompleted',
        'lockedApps',
        'failed_attempts',
        'lock_until',
        'security_question',
        'security_answer',
        'initialSetupDone',
      ]);
      if (AppLockModule && typeof AppLockModule.setLockedApps === 'function') {
        await AppLockModule.setLockedApps([]);
      }
      console.log('✅ App reset successfully from LockScreenManager');
      setShowLockScreen(false);
      setCurrentApp(null);
      setIsUnlocking(false);
      if (onResetToSetup) onResetToSetup();
    } catch (error) {
      console.error('❌ Error resetting app from LockScreenManager:', error);
      throw error;
    }
  };

  return (
    <View style={{flex: 1}}>
      {/* CRITICAL FIX: Hide children when lock screen is visible */}
      <View style={{flex: 1, display: showLockScreen ? 'none' : 'flex'}}>
        {children}
      </View>

      {/* Lock Screen should be absolutely positioned to cover everything */}
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
