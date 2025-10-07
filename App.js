import React, {useState, useEffect, useRef} from 'react';
import {StyleSheet, StatusBar, Alert, BackHandler, View} from 'react-native';
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

  const navigationRef = useRef();

  useEffect(() => {
    console.log('🚀 App component mounted');
    checkSetupStatus();
    checkSecurity();
    checkLockScreenMode();
    return () => {
      // Cleanup if needed
    };
  }, []);

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

  const handleResetToSetup = async () => {
    console.log('🔄 Resetting app to setup state...');
    try {
      // Clear all stored data
      await Keychain.resetGenericPassword({
        service: 'applock_service',
      });

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

      // Navigate to setup screen
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

  const handleForgotPin = () => {
    console.log('🔄 Handling forgot PIN');
    if (navigationRef.current) {
      navigationRef.current.navigate('ForgotPin');
    }
  };

  const handleSetupComplete = () => {
    console.log('✅ Setup completed');
    setIsSetupCompleted(true);
  };

  const checkSecurity = async () => {
    try {
      const deviceSecurity = await checkDeviceSecurity();
      const appTampering = await checkAppTampering();

      const warnings = [];

      if (deviceSecurity.isRooted) {
        warnings.push('Rooted device detected - security may be compromised');
      }

      if (deviceSecurity.isJailBroken) {
        warnings.push(
          'Jailbroken device detected - security may be compromised',
        );
      }

      if (appTampering.isEmulator) {
        warnings.push('Running in emulator - security may be compromised');
      }

      if (warnings.length > 0) {
        setSecurityWarning(warnings.join('\n• '));

        if (deviceSecurity.isRooted || deviceSecurity.isJailBroken) {
          Alert.alert(
            'Security Warning',
            `Your device may not be secure:\n\n• ${warnings.join(
              '\n• ',
            )}\n\nFor maximum security, please use a non-rooted device.`,
            [
              {
                text: 'Continue Anyway',
                style: 'default',
              },
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

      if (
        AppLockModule &&
        typeof AppLockModule.getPendingLockedApp === 'function'
      ) {
        const pendingApp = await AppLockModule.getPendingLockedApp();

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

      console.log('📭 App started in normal mode, showing splash screen');
      const timer = setTimeout(() => {
        setIsSplashVisible(false);
      }, 2000);

      return () => clearTimeout(timer);
    } catch (error) {
      console.error('❌ Error checking lock screen mode:', error);
      const timer = setTimeout(() => {
        setIsSplashVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  };

  const handleSplashComplete = () => {
    console.log('✅ Splash screen animation completed');
    setIsSplashVisible(false);
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

  // If we're in lock screen mode, skip splash and show the lock screen immediately
  if (isLockScreenMode) {
    console.log('🔒 Rendering in lock screen mode (no splash)');
    return (
      <GestureHandlerRootView style={styles.container}>
        <LanguageProvider>
          <AlertProvider>
            <PaperProvider theme={theme}>
              <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
              <NavigationContainer ref={navigationRef}>
                <LockScreenManager
                  initialLockedApp={pendingLockedApp}
                  forceLockScreen={true}
                  onForgotPin={handleForgotPin}
                  onResetToSetup={handleResetToSetup}>
                  <AppNavigator
                    isSetupCompleted={isSetupCompleted}
                    onSetupComplete={handleSetupComplete}
                  />
                </LockScreenManager>
              </NavigationContainer>
            </PaperProvider>
          </AlertProvider>
        </LanguageProvider>
      </GestureHandlerRootView>
    );
  }

  // Show splash screen for normal app start
  if (isSplashVisible) {
    console.log('🎨 Rendering splash screen');
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SimpleSplashScreen onAnimationComplete={handleSplashComplete} />
      </GestureHandlerRootView>
    );
  }

  // Show main app after splash
  console.log('🏠 Rendering main app after splash');
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
                onForgotPin={handleForgotPin}
                onResetToSetup={handleResetToSetup}>
                <AppNavigator
                  isSetupCompleted={isSetupCompleted}
                  onSetupComplete={handleSetupComplete}
                />
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
