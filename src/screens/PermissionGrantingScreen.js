import React from 'react';
import {View, Text, StyleSheet, ScrollView, Linking, Alert} from 'react-native';
import {Button} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

const PermissionGrantingScreen = () => {
  const navigation = useNavigation();

  const requestAccessibilityPermission = async () => {
    try {
      // This would open accessibility settings
      Linking.openSettings();
    } catch (error) {
      Alert.alert('Error', 'Could not open settings');
    }
  };

  const requestOverlayPermission = async () => {
    try {
      // This would request overlay permission
      // Implementation varies by Android version
      Alert.alert('Info', 'Please grant overlay permission in the next screen');
      Linking.openSettings();
    } catch (error) {
      Alert.alert('Error', 'Could not request overlay permission');
    }
  };

  const arePermissionsGranted = () => {
    // Check if all permissions are granted (pseudo-code)
    // This would be implemented with actual permission checks
    navigation.navigate('Setup');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>App Lock</Text>
      <Text style={styles.subtitle}>
        We need some permissions to protect your apps
      </Text>

      <View style={styles.permissionItem}>
        <Text style={styles.permissionTitle}>Accessibility Service</Text>
        <Text style={styles.permissionDesc}>
          Required to detect when apps are launched and lock them
        </Text>
        <Button
          mode="contained"
          onPress={requestAccessibilityPermission}
          style={styles.button}>
          Grant Accessibility Permission
        </Button>
      </View>

      <View style={styles.permissionItem}>
        <Text style={styles.permissionTitle}>Display Over Other Apps</Text>
        <Text style={styles.permissionDesc}>
          Required to show the lock screen over other applications
        </Text>
        <Button
          mode="contained"
          onPress={requestOverlayPermission}
          style={styles.button}>
          Grant Overlay Permission
        </Button>
      </View>

      <View style={styles.permissionItem}>
        <Text style={styles.permissionTitle}>Usage Access</Text>
        <Text style={styles.permissionDesc}>
          Required to see which apps are installed and running
        </Text>
        <Button
          mode="contained"
          onPress={requestAccessibilityPermission}
          style={styles.button}>
          Grant Usage Access
        </Button>
      </View>

      <Button
        mode="contained"
        onPress={arePermissionsGranted}
        style={styles.continueButton}
        labelStyle={styles.continueButtonLabel}>
        Continue
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#6200ee',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  permissionItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  permissionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  button: {
    marginTop: 5,
  },
  continueButton: {
    marginTop: 30,
    paddingVertical: 8,
    backgroundColor: '#6200ee',
  },
  continueButtonLabel: {
    fontSize: 16,
  },
});

export default PermissionGrantingScreen;
