import React, {useState, useEffect, useRef} from 'react';
import {StyleSheet, StatusBar} from 'react-native';
import {Provider as PaperProvider, DefaultTheme} from 'react-native-paper';
import AppNavigator from './src/navigation/AppNavigator';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import SimpleSplashScreen from './src/components/SimpleSplashScreen';
import LockScreenManager from './src/components/LockScreenManager';
import {NativeModules} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';

const {AppLockModule} = NativeModules;

// Custom theme with #1E88E5 as primary color
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

  // Create a navigation reference
  const navigationRef = useRef();

  const handleForgotPin = () => {
    // Use the navigation ref to navigate
    navigationRef.current?.navigate('ForgotPin');
  };

  useEffect(() => {
    console.log('🚀 App component mounted');
    checkLockScreenMode();
    return () => {
      // Cleanup if needed
    };
  }, []);

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
      <PaperProvider theme={theme}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <NavigationContainer ref={navigationRef}>
          <LockScreenManager onForgotPin={handleForgotPin}>
            <AppNavigator />
          </LockScreenManager>
        </NavigationContainer>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
