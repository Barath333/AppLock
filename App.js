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

// Import i18n and LanguageProvider
import './src/i18n/index';
import {LanguageProvider} from './src/contexts/LanguageContext';

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

  const navigationRef = useRef();

  const handleForgotPin = () => {
    navigationRef.current?.navigate('ForgotPin');
  };

  useEffect(() => {
    console.log('🚀 App component mounted');
    checkSecurity();
    checkLockScreenMode();
    return () => {
      // Cleanup if needed
    };
  }, []);

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

  // If we're in lock screen mode, skip splash and show the lock screen immediately
  if (isLockScreenMode) {
    console.log('🔒 Rendering in lock screen mode (no splash)');
    return (
      <GestureHandlerRootView style={styles.container}>
        <LanguageProvider>
          <PaperProvider theme={theme}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
            <NavigationContainer ref={navigationRef}>
              <LockScreenManager
                initialLockedApp={pendingLockedApp}
                forceLockScreen={true}
                onForgotPin={handleForgotPin}>
                <AppNavigator />
              </LockScreenManager>
            </NavigationContainer>
          </PaperProvider>
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
            <LockScreenManager onForgotPin={handleForgotPin}>
              <AppNavigator />
            </LockScreenManager>
          </NavigationContainer>
        </PaperProvider>
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
