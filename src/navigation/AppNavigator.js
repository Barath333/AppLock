import React, {useState, useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createDrawerNavigator} from '@react-navigation/drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SetupScreen from '../screens/SetupScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PremiumUpgradeScreen from '../screens/PremiumUpgradeScreen';
import PermissionGrantingScreen from '../screens/PermissionGrantingScreen';
import HomeScreen from '../screens/HomeScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import SecurityQuestionScreen from '../screens/SecurityQuestionScreen';
import AboutScreen from '../screens/AboutScreen';
import LockScreen from '../components/LockScreen';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

function MainDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        drawerStyle: {
          backgroundColor: '#FFFFFF',
        },
        drawerLabelStyle: {
          color: '#333',
        },
      }}>
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      <Drawer.Screen name="Premium" component={PremiumUpgradeScreen} />
    </Drawer.Navigator>
  );
}

function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      console.log('🔍 Checking setup status...');

      // Check if setup is completed
      const setupCompleted = await AsyncStorage.getItem('setupCompleted');
      const hasPIN = await checkIfPINExists();

      console.log('📋 Setup Status:', {setupCompleted, hasPIN});

      if (setupCompleted === 'true' && hasPIN) {
        console.log('✅ Setup already completed, going to main app');
        setInitialRoute('Main');
      } else {
        console.log('🔄 Setup not completed, showing permission screen');
        setInitialRoute('PermissionGranting');
      }
    } catch (error) {
      console.error('❌ Error checking setup status:', error);
      setInitialRoute('PermissionGranting');
    } finally {
      setIsLoading(false);
    }
  };

  const checkIfPINExists = async () => {
    try {
      const {AppLockModule} = require('react-native').NativeModules;
      // Try to get locked apps - if this works, the app is probably set up
      const lockedApps = await AppLockModule.getLockedApps();
      return Array.isArray(lockedApps);
    } catch (error) {
      return false;
    }
  };

  if (isLoading || initialRoute === null) {
    // Return a minimal loading view or null
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          // Prevent any animations that might show the home screen briefly
          animationEnabled: false,
          gestureEnabled: false,
        }}>
        <Stack.Screen
          name="PermissionGranting"
          component={PermissionGrantingScreen}
        />
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="Lock" component={LockScreen} />
        <Stack.Screen
          name="Main"
          component={MainDrawer}
          options={{
            // Disable all animations and gestures for the main screen
            animationEnabled: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="ChangePassword"
          component={ChangePasswordScreen}
          options={{
            headerShown: true,
            title: 'Change Password',
            animationEnabled: true,
          }}
        />
        <Stack.Screen
          name="SecurityQuestion"
          component={SecurityQuestionScreen}
          options={{
            headerShown: true,
            title: 'Security Question',
            animationEnabled: true,
          }}
        />
        <Stack.Screen
          name="About"
          component={AboutScreen}
          options={{
            headerShown: true,
            title: 'About',
            animationEnabled: true,
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
