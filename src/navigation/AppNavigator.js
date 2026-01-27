import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {createStackNavigator} from '@react-navigation/stack';
import {createDrawerNavigator} from '@react-navigation/drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

import SetupScreen from '../screens/SetupScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PremiumUpgradeScreen from '../screens/PremiumUpgradeScreen';
import PermissionGrantingScreen from '../screens/PermissionGrantingScreen';
import HomeScreen from '../screens/HomeScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import SecurityQuestionScreen from '../screens/SecurityQuestionScreen';
import AboutScreen from '../screens/AboutScreen';
import ForgotPinScreen from '../screens/ForgotPinScreen';
import LanguageScreen from '../screens/LanguageScreen';

import {DrawerContentScrollView, DrawerItem} from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {useTranslation} from 'react-i18next';
import ForgotPinResetScreen from '../screens/ForgotPinResetScreen';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Custom Drawer Content with enhanced styling
function CustomDrawerContent(props) {
  const {t} = useTranslation();

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.drawerContainer}>
      <View style={styles.drawerHeader}>
        <View style={styles.logoContainer}>
          <Icon name="shield-lock" size={40} color="#1E88E5" />
        </View>
        <Text style={styles.appName}>{t('common.app_name')}</Text>
        <Text style={styles.appSubtitle}>{t('splash.subtitle')}</Text>
      </View>

      <View style={styles.drawerItems}>
        <DrawerItem
          icon={({color, size}) => (
            <Icon name="home" color={color} size={size} />
          )}
          label={t('drawer.home')}
          labelStyle={styles.drawerLabel}
          onPress={() => props.navigation.navigate('Home')}
        />
        <DrawerItem
          icon={({color, size}) => (
            <Icon name="cog" color={color} size={size} />
          )}
          label={t('drawer.settings')}
          labelStyle={styles.drawerLabel}
          onPress={() => props.navigation.navigate('Settings')}
        />
        {/* <DrawerItem
          icon={({color, size}) => (
            <Icon name="crown" color={color} size={size} />
          )}
          label={t('drawer.premium')}
          labelStyle={styles.drawerLabel}
          onPress={() => props.navigation.navigate('Premium')}
        /> */}
        <DrawerItem
          icon={({color, size}) => (
            <Icon name="shield-key" color={color} size={size} />
          )}
          label={t('drawer.security')}
          labelStyle={styles.drawerLabel}
          onPress={() => props.navigation.navigate('SecurityQuestion')}
        />
        <DrawerItem
          icon={({color, size}) => (
            <Icon name="information" color={color} size={size} />
          )}
          label={t('drawer.about')}
          labelStyle={styles.drawerLabel}
          onPress={() => props.navigation.navigate('About')}
        />
      </View>

      <View style={styles.drawerFooter}>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>
    </DrawerContentScrollView>
  );
}

function MainDrawer() {
  return (
    <Drawer.Navigator
      initialRouteName="Home"
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerStyle: {
          backgroundColor: '#FFFFFF',
          width: 280,
        },
        drawerActiveTintColor: '#1E88E5',
        drawerInactiveTintColor: '#666',
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '500',
          marginLeft: -16,
        },
        headerStyle: {
          backgroundColor: '#1E88E5',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
      }}>
      <Drawer.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'AppLock',
          drawerIcon: ({color, size}) => (
            <Icon name="home" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          drawerIcon: ({color, size}) => (
            <Icon name="cog" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="Premium"
        component={PremiumUpgradeScreen}
        options={{
          title: 'Premium',
          drawerIcon: ({color, size}) => (
            <Icon name="crown" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="SecurityQuestion"
        component={SecurityQuestionScreen}
        options={{
          title: 'Security Question',
          drawerIcon: ({color, size}) => (
            <Icon name="shield-key" color={color} size={size} />
          ),
        }}
      />
      <Drawer.Screen
        name="About"
        component={AboutScreen}
        options={{
          title: 'About',
          drawerIcon: ({color, size}) => (
            <Icon name="information" color={color} size={size} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
  },
  drawerHeader: {
    padding: 20,
    backgroundColor: '#1E88E5',
    borderBottomRightRadius: 20,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  drawerItems: {
    flex: 1,
    paddingTop: 10,
  },
  drawerLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  versionText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 12,
  },
});

function AppNavigator({isSetupCompleted, onSetupComplete}) {
  const [initialRoute, setInitialRoute] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If isSetupCompleted is provided from parent, use it
    if (isSetupCompleted !== null && isSetupCompleted !== undefined) {
      console.log('📋 Using setup status from parent:', isSetupCompleted);
      determineInitialRoute(isSetupCompleted);
    } else {
      // Fallback to checking locally
      checkSetupStatus();
    }
  }, [isSetupCompleted]);

  const checkPermissionsStatus = async () => {
    try {
      // Check if we have stored permission status
      const permissionsGranted = await AsyncStorage.getItem(
        'permissionsGranted',
      );
      console.log('📋 Permissions granted status:', permissionsGranted);
      return permissionsGranted === 'true';
    } catch (error) {
      console.error('❌ Error checking permissions status:', error);
      return false;
    }
  };

  const determineInitialRoute = async setupCompleted => {
    try {
      if (setupCompleted) {
        console.log('✅ Setup completed, going to main app');
        setInitialRoute('Main');
      } else {
        console.log('🔄 Setup not completed, showing setup flow');

        // Check if we have permissions granted
        const permissionsGranted = await checkPermissionsStatus();

        if (permissionsGranted) {
          console.log('✅ Permissions granted, showing setup screen');
          setInitialRoute('Setup');
        } else {
          console.log('📋 Permissions not granted, showing permission screen');
          setInitialRoute('PermissionGranting');
        }
      }
    } catch (error) {
      console.error('❌ Error determining initial route:', error);
      setInitialRoute('PermissionGranting');
    } finally {
      setIsLoading(false);
    }
  };

  const checkIfPINExists = async () => {
    try {
      console.log('🔑 Checking if PIN exists in Keychain...');
      const credentials = await Keychain.getGenericPassword({
        service: 'applock_service',
      });

      const hasPIN = !!(credentials && credentials.password);
      console.log('📋 PIN exists:', hasPIN);
      return hasPIN;
    } catch (error) {
      console.error('❌ Error checking PIN existence:', error);
      return false;
    }
  };

// AppNavigator.js - Update the checkSetupStatus function

const checkSetupStatus = async () => {
  try {
    console.log('🔍 Checking setup status locally...');

    const setupCompleted = await AsyncStorage.getItem('setupCompleted');
    const hasPIN = await checkIfPINExists();
    const hasSecurityQuestion = await AsyncStorage.getItem('security_question');

    console.log('📋 Local Setup Status:', {setupCompleted, hasPIN, hasSecurityQuestion});

    if (setupCompleted === 'true' && hasPIN) {
      // Check if security question is set
      if (!hasSecurityQuestion) {
        console.log('⚠️ Setup completed but security question not set');
        // We'll handle this in HomeScreen
      }
      await determineInitialRoute(true);
    } else {
      await determineInitialRoute(false);
    }
  } catch (error) {
    console.error('❌ Error checking setup status:', error);
    await determineInitialRoute(false);
  }
};

  const handleSetupComplete = () => {
    console.log('✅ Setup completed in AppNavigator');
    if (onSetupComplete) {
      onSetupComplete();
    }
    setInitialRoute('Main');
  };

  if (isLoading || initialRoute === null) {
    console.log('⏳ AppNavigator loading...');
    return null;
  }

  console.log('🚀 AppNavigator initial route:', initialRoute);

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: true,
      }}>
      {/* Permission Granting Screen - First time setup */}
      <Stack.Screen
        name="PermissionGranting"
        component={PermissionGrantingScreen}
        options={{
          gestureEnabled: false,
        }}
      />

      {/* Setup Screen - After permissions are granted */}
      <Stack.Screen
        name="Setup"
        options={{
          gestureEnabled: false,
        }}>
        {props => (
          <SetupScreen {...props} onSetupComplete={handleSetupComplete} />
        )}
      </Stack.Screen>

      {/* Main App - After setup is completed */}
      <Stack.Screen
        name="Main"
        component={MainDrawer}
        options={{
          gestureEnabled: true,
          animationEnabled: true,
        }}
      />

      {/* Modal Screens - Shown over main app */}
      <Stack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{
          headerShown: true,
          title: 'Change Password',
          animationEnabled: true,
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="SecurityQuestion"
        component={SecurityQuestionScreen}
        options={{
          headerShown: true,
          title: 'Security Question',
          animationEnabled: true,
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{
          headerShown: true,
          title: 'About',
          animationEnabled: true,
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="ForgotPin"
        component={ForgotPinScreen}
        options={{
          headerShown: true,
          title: 'Forgot PIN',
          animationEnabled: true,
          presentation: 'modal',
        }}
      />

      <Stack.Screen
        name="Language"
        component={LanguageScreen}
        options={{
          headerShown: true,
          title: 'Language',
          animationEnabled: true,
          presentation: 'modal',
        }}
      />
     <Stack.Screen
  name="ForgotPinReset"
  component={ForgotPinResetScreen}
  options={{
    headerShown: true,
    title: 'Reset PIN',
    animationEnabled: true,
    presentation: 'modal',
  }}
/>
    </Stack.Navigator>
  );
}

export default AppNavigator;
