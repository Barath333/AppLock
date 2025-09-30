// src/components/DebugScreen.js
import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Button,
  Linking,
} from 'react-native';
import {Card, Title, Paragraph} from 'react-native-paper';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {AppLockModule, PermissionModule} = NativeModules;

const DebugScreen = () => {
  const [debugInfo, setDebugInfo] = useState({});
  const [lockedApps, setLockedApps] = useState([]);

  useEffect(() => {
    loadDebugInfo();
    loadLockedApps();
  }, []);

  const loadDebugInfo = async () => {
    try {
      const accessibility = await PermissionModule.getAccessibilityServiceStatus();
      const overlay = await PermissionModule.isOverlayPermissionGranted();
      const usage = await PermissionModule.isUsageAccessGranted();
      const serviceRunning = await AppLockModule.isAccessibilityServiceRunning();
      
      setDebugInfo({
        accessibility,
        overlay,
        usage,
        serviceRunning,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Debug info error:', error);
    }
  };

  const loadLockedApps = async () => {
    try {
      const saved = await AsyncStorage.getItem('lockedApps');
      setLockedApps(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.error('Error loading locked apps:', error);
    }
  };

  const testAccessibilityService = async () => {
    try {
      const isRunning = await AppLockModule.isAccessibilityServiceRunning();
      Alert.alert(
        'Accessibility Service Test',
        `Service is ${isRunning ? 'RUNNING' : 'NOT RUNNING'}\n\nPlease ensure:\n1. Service is enabled in Accessibility settings\n2. All permissions are granted\n3. Service is not blocked by battery optimization`,
        [
          {text: 'Open Accessibility Settings', onPress: () => PermissionModule.openAccessibilitySettings()},
          {text: 'OK'},
        ],
      );
    } catch (error) {
      Alert.alert('Test Failed', error.message);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will reset all locked apps and settings.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear',
          onPress: async () => {
            await AsyncStorage.removeItem('lockedApps');
            await AsyncStorage.removeItem('applock_pin');
            await AppLockModule.setLockedApps([]);
            setLockedApps([]);
            Alert.alert('Success', 'All data cleared');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>🔧 Debug Information</Title>
          <Paragraph>Accessibility: {debugInfo.accessibility ? '✅' : '❌'}</Paragraph>
          <Paragraph>Overlay Permission: {debugInfo.overlay ? '✅' : '❌'}</Paragraph>
          <Paragraph>Usage Access: {debugInfo.usage ? '✅' : '❌'}</Paragraph>
          <Paragraph>Service Running: {debugInfo.serviceRunning ? '✅' : '❌'}</Paragraph>
          <Paragraph>Last Updated: {debugInfo.timestamp}</Paragraph>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Title>🔒 Locked Apps</Title>
          {lockedApps.length > 0 ? (
            lockedApps.map((app, index) => (
              <Paragraph key={index}>• {typeof app === 'object' ? app.packageName : app}</Paragraph>
            ))
          ) : (
            <Paragraph>No apps locked</Paragraph>
          )}
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button title="🔄 Refresh Debug Info" onPress={loadDebugInfo} />
        <View style={styles.spacer} />
        <Button title="🧪 Test Accessibility Service" onPress={testAccessibilityService} />
        <View style={styles.spacer} />
        <Button title="⚙️ Open Accessibility Settings" onPress={() => PermissionModule.openAccessibilitySettings()} />
        <View style={styles.spacer} />
        <Button title="🗑️ Clear All Data" onPress={clearAllData} color="red" />
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Title>📋 Testing Instructions</Title>
          <Paragraph>1. Lock an app in Home screen</Paragraph>
          <Paragraph>2. Go to home screen</Paragraph>
          <Paragraph>3. Open the locked app</Paragraph>
          <Paragraph>4. Check if lock screen appears</Paragraph>
          <Paragraph>5. Check Logs for accessibility events</Paragraph>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 16,
  },
  buttonContainer: {
    marginBottom: 16,
  },
  spacer: {
    height: 8,
  },
});

export default DebugScreen;