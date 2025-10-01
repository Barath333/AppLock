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

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

function MainDrawer() {
  return (
    <Drawer.Navigator initialRouteName="Home">
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
    // You can return a loading screen here
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{headerShown: false}}>
        <Stack.Screen
          name="PermissionGranting"
          component={PermissionGrantingScreen}
        />
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="Main" component={MainDrawer} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
