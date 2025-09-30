import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createDrawerNavigator} from '@react-navigation/drawer';

import SetupScreen from '../screens/SetupScreen';

import SettingsScreen from '../screens/SettingsScreen';
import PremiumUpgradeScreen from '../screens/PremiumUpgradeScreen';
import PermissionGrantingScreen from '../screens/PermissionGrantingScreen';
import HomeScreen from '../screens/HomeScreen';
import DebugScreen from '../screens/DebugScreen';

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
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="PermissionGranting"
        screenOptions={{headerShown: false}}>
        <Stack.Screen
          name="PermissionGranting"
          component={PermissionGrantingScreen}
        />
        {/* <Stack.Screen name="Debug" component={DebugScreen} /> */}
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="Main" component={MainDrawer} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
