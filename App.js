import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  StyleSheet,
  StatusBar,
  Alert,
  BackHandler,
  View,
  AppState,
} from 'react-native';
import {
  Provider as PaperProvider,
  DefaultTheme,
  Text,
} from 'react-native-paper';
import AppNavigator from './src/navigation/AppNavigator';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import SimpleSplashScreen from './src/components/SimpleSplashScreen';
import LockScreenManager from './src/components/LockScreenManager';
import {NativeModules} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {
  checkDeviceSecurity,
  checkAppTampering,
} from './src/utils/securityUtils';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import i18n and LanguageProvider
import './src/i18n/index';
import {LanguageProvider} from './src/contexts/LanguageContext';
import {AlertProvider} from './src/contexts/AlertContext';

const {AppLockModule} = NativeModules;

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#1E88E5',
    accent: '#4FC3F7',
    background: '#FFFFFF',
    surface: '#FFFFFF',
    text: '#333333',
    placeholder: '#888888',
  },
};

export default function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [isLockScreenMode, setIsLockScreenMode] = useState(false);
  const [pendingLockedApp, setPendingLockedApp] = useState(null);
  const [securityWarning, setSecurityWarning] = useState(null);
  const [isSetupCompleted, setIsSetupCompleted] = useState(null);
  const [appState, setAppState] = useState('active');
  const [isAppLocked, setIsAppLocked] = useState(false);

  const navigationRef = useRef();

  useEffect(() => {
    console.log('🚀 App component mounted');
    checkSetupStatus();
    checkSecurity();
    checkLockScreenMode();
    checkIfAppLockIsLocked();

    // Listen for app state changes
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = nextAppState => {
    console.log('📱 App state changed:', appState, '->', nextAppState);
    setAppState(nextAppState);

    if (nextAppState === 'active') {
      console.log('📱 App became active - checking lock status');
      // When app becomes active, check if we should show lock screen
      setTimeout(() => {
        checkIfAppLockIsLocked();
        checkLockScreenMode();
      }, 100);
    }
  };

  const checkSetupStatus = async () => {
    try {
      const setupCompleted = await AsyncStorage.getItem('setupCompleted');
      console.log('📋 Setup status from storage:', setupCompleted);
      setIsSetupCompleted(setupCompleted === 'true');
    } catch (error) {
      console.error('Error checking setup status:', error);
      setIsSetupCompleted(false);
    }
  };

  const checkIfAppLockIsLocked = async () => {
    try {
      console.log('🔍 Checking if App Lock is locked...');
      
      // Skip if we're already in lock screen mode
      if (isLockScreenMode) {
        console.log('⏭️ Already in lock screen mode, skipping check');
        return;
      }
      
      // Check both conditions in parallel
      const [lockedApps, securityQuestion, securityAnswer, justSetSecurityQuestion] = await Promise.all([
        AsyncStorage.getItem('lockedApps'),
        AsyncStorage.getItem('security_question'),
        AsyncStorage.getItem('security_answer'),
        AsyncStorage.getItem('just_set_security_question')
      ]);

      // Only lock our app if security question is set
      if (securityQuestion && securityAnswer) {
        console.log('✅ Security question exists');
        
        if (lockedApps) {
          const lockedAppsArray = JSON.parse(lockedApps);
          const isLocked = lockedAppsArray.includes('com.applock');
          console.log('🔒 App Lock locked status:', isLocked);
          setIsAppLocked(isLocked);

          // Only show lock screen if app is locked AND we're not already showing it
          // AND we didn't just set up security question
          if (isLocked && !isLockScreenMode && !pendingLockedApp) {
            // If the just_set_security_question flag is set, we should still show the lock screen
            // but then clear the flag after it's shown.
            console.log('🚨 App Lock is LOCKED - showing lock screen');
            
            const lockedAppEvent = {
              packageName: 'com.applock',
              className: null,
              timestamp: Date.now().toString(),
            };

            setIsLockScreenMode(true);
            setPendingLockedApp(lockedAppEvent);
            
            // Don't hide splash screen if it's already hidden
            if (isSplashVisible) {
              setIsSplashVisible(false);
            }
          }

          // Always clear the just_set_security_question flag after we've processed it
          if (justSetSecurityQuestion === 'true') {
            console.log('🧹 Clearing just_set_security_question flag');
            await AsyncStorage.removeItem('just_set_security_question');
          }
        }
      } else {
        console.log('🔓 Security question not set, keeping App Lock unlocked');
      }
    } catch (error) {
      console.error('❌ Error checking if App Lock is locked:', error);
    }
  };

  const handleResetToSetup = async () => {
    console.log('🔄 Resetting app to setup state...');
    try {
      await Keychain.resetGenericPassword({service: 'applock_service'});
      await AsyncStorage.multiRemove([
        'setupCompleted',
        'lockedApps',
        'failed_attempts',
        'lock_until',
        'security_question',
        'security_answer',
      ]);
      if (AppLockModule && typeof AppLockModule.setLockedApps === 'function') {
        await AppLockModule.setLockedApps([]);
      }
      console.log('✅ App reset successfully');
      setIsSetupCompleted(false);
      setIsLockScreenMode(false);
      setIsAppLocked(false);
      if (navigationRef.current) {
        navigationRef.current.reset({
          index: 0,
          routes: [{name: 'Setup'}],
        });
      }
    } catch (error) {
      console.error('❌ Error resetting app:', error);
      Alert.alert(
        'Error',
        'Failed to reset app. Please restart the application.',
      );
    }
  };

  const handleForgotPin = useCallback(() => {
    console.log('🔄 Handling forgot PIN from lock screen');
    if (isLockScreenMode) {
      console.log('🔓 Exiting lock screen mode');
      setIsLockScreenMode(false);
      setPendingLockedApp(null);

      // Defer navigation to allow normal mode to render
      setTimeout(() => {
        if (navigationRef.current) {
          navigationRef.current.navigate('ForgotPinReset', {
            onResetComplete: () => {
              // After successful PIN reset, re‑enter lock screen
              setIsLockScreenMode(true);
              setPendingLockedApp({
                packageName: 'com.applock',
                timestamp: Date.now().toString(),
              });
            },
            onCancel: () => {
              // User cancelled (back button) – return to lock screen
              setIsLockScreenMode(true);
              setPendingLockedApp({
                packageName: 'com.applock',
                timestamp: Date.now().toString(),
              });
            },
          });
        }
      }, 0);
    }
  }, [isLockScreenMode]);

  const handleSetupComplete = () => {
    console.log('✅ Setup completed');
    setIsSetupCompleted(true);
  };

  const checkSecurity = async () => {
    try {
      const deviceSecurity = await checkDeviceSecurity();
      const appTampering = await checkAppTampering();
      const warnings = [];

      if (deviceSecurity.isRooted) warnings.push('Rooted device detected');
      if (deviceSecurity.isJailBroken)
        warnings.push('Jailbroken device detected');
      if (appTampering.isEmulator) warnings.push('Running in emulator');

      if (warnings.length > 0) {
        setSecurityWarning(warnings.join('\n• '));
        if (deviceSecurity.isRooted || deviceSecurity.isJailBroken) {
          Alert.alert(
            'Security Warning',
            `Your device may not be secure:\n\n• ${warnings.join('\n• ')}`,
            [
              {text: 'Continue Anyway', style: 'default'},
              {
                text: 'Exit App',
                style: 'destructive',
                onPress: () => BackHandler.exitApp(),
              },
            ],
          );
        }
      }
    } catch (error) {
      console.error('Security check error:', error);
    }
  };

  const checkLockScreenMode = async () => {
    try {
      console.log('🔍 Checking if app started in lock screen mode...');

      // First check for pending locked app from accessibility service
      if (
        AppLockModule &&
        typeof AppLockModule.getPendingLockedApp === 'function'
      ) {
        const pendingApp = await AppLockModule.getPendingLockedApp();
        console.log('📦 Pending locked app from service:', pendingApp);

        if (pendingApp && pendingApp.packageName) {
          console.log(
            '🚨 App started in lock screen mode for:',
            pendingApp.packageName,
          );
          setIsLockScreenMode(true);
          setPendingLockedApp(pendingApp);
          setIsSplashVisible(false);
          return;
        }
      }

      // CRITICAL FIX: If no pending app but App Lock is locked, force lock screen
      await checkIfAppLockIsLocked();

      // If we're already in lock screen mode from the check above, return
      if (isLockScreenMode && pendingLockedApp) {
        return;
      }

      console.log('📭 App started in normal mode');
      
      // Always show splash screen for 2 seconds on app start
      const timer = setTimeout(() => {
        console.log('⏰ Hiding splash screen');
        setIsSplashVisible(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    } catch (error) {
      console.error('❌ Error checking lock screen mode:', error);
      // Don't show splash on error
      setIsSplashVisible(false);
    }
  };

  const handleSplashComplete = () => {
    console.log('✅ Splash screen animation completed');
    setIsSplashVisible(false);
  };

  const handleAppUnlock = () => {
    console.log('✅ App unlocked - switching to normal mode');
    setIsLockScreenMode(false);
    setPendingLockedApp(null);
  };

  // Show loading state while checking setup status
  if (isSetupCompleted === null) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SimpleSplashScreen onAnimationComplete={handleSplashComplete} />
      </GestureHandlerRootView>
    );
  }

  // If in lock screen mode, only show LockScreenManager
  if (isLockScreenMode && pendingLockedApp) {
    console.log('🔒 Rendering in LOCK SCREEN ONLY mode');
    return (
      <GestureHandlerRootView style={styles.container}>
        <LanguageProvider>
          <AlertProvider>
            <PaperProvider theme={theme}>
              <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
              <LockScreenManager
                initialLockedApp={pendingLockedApp}
                forceLockScreen={true}
                onForgotPin={handleForgotPin}
                onResetToSetup={handleResetToSetup}
                isAppLockMode={true}
                onUnlock={handleAppUnlock}
              />
            </PaperProvider>
          </AlertProvider>
        </LanguageProvider>
      </GestureHandlerRootView>
    );
  }

  // Main app render for normal mode
  return (
    <GestureHandlerRootView style={styles.container}>
      <LanguageProvider>
        <AlertProvider>
          <PaperProvider theme={theme}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            {securityWarning && (
              <View style={styles.securityWarning}>
                <Text style={styles.securityWarningText}>
                  ⚠️ {securityWarning}
                </Text>
              </View>
            )}
            <NavigationContainer ref={navigationRef}>
              <LockScreenManager
                initialLockedApp={null}
                forceLockScreen={false}
                onForgotPin={handleForgotPin}
                onResetToSetup={handleResetToSetup}
                isAppLockMode={false}>
                {isSplashVisible ? (
                  <SimpleSplashScreen
                    onAnimationComplete={handleSplashComplete}
                  />
                ) : (
                  <AppNavigator
                    isSetupCompleted={isSetupCompleted}
                    onSetupComplete={handleSetupComplete}
                  />
                )}
              </LockScreenManager>
            </NavigationContainer>
          </PaperProvider>
        </AlertProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  securityWarning: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FF9800',
  },
  securityWarningText: {
    color: '#E65100',
    fontSize: 12,
    textAlign: 'center',
  },
});