import React, {useState, useEffect} from 'react';
import {StyleSheet, StatusBar} from 'react-native';
import {Provider as PaperProvider, DefaultTheme} from 'react-native-paper';
import AppNavigator from './src/navigation/AppNavigator';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import SimpleSplashScreen from './src/components/SimpleSplashScreen';
import LockScreenManager from './src/components/LockScreenManager';

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

  useEffect(() => {
    // Clean up any existing listeners when app starts
    return () => {
      // Cleanup if needed
    };
  }, []);

  const handleSplashComplete = () => {
    setIsSplashVisible(false);
  };

  if (isSplashVisible) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <SimpleSplashScreen onAnimationComplete={handleSplashComplete} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <PaperProvider theme={theme}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <LockScreenManager>
          <AppNavigator />
        </LockScreenManager>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
