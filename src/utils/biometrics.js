// src/utils/biometrics.js
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let ReactNativeBiometrics = null;
let biometricsInstance = null;

export const initializeBiometrics = async () => {
  try {
    const biometricsModule = require('react-native-biometrics');
    
    // Handle different export formats
    if (biometricsModule.default) {
      ReactNativeBiometrics = biometricsModule.default;
    } else if (biometricsModule.ReactNativeBiometrics) {
      ReactNativeBiometrics = biometricsModule.ReactNativeBiometrics;
    } else {
      ReactNativeBiometrics = biometricsModule;
    }
    
    console.log('✅ Biometrics module initialized');
    
    // Check if we need to create an instance
    if (typeof ReactNativeBiometrics === 'function') {
      biometricsInstance = new ReactNativeBiometrics({
        allowDeviceCredentials: true,
      });
      console.log('🔧 Created biometrics instance');
    } else {
      biometricsInstance = ReactNativeBiometrics;
      console.log('📦 Using biometrics module directly');
    }
    
    return true;
  } catch (error) {
    console.warn('❌ Failed to initialize biometrics:', error.message);
    return false;
  }
};

export const isBiometricsAvailable = async () => {
  if (!biometricsInstance) {
    const initialized = await initializeBiometrics();
    if (!initialized) return {available: false, biometryType: ''};
  }

  try {
    let result;
    
    // Check if isSensorAvailable is a function
    if (typeof biometricsInstance.isSensorAvailable === 'function') {
      result = await biometricsInstance.isSensorAvailable();
    } 
    // Check if it's a property that returns a promise
    else if (biometricsInstance.isSensorAvailable && 
             typeof biometricsInstance.isSensorAvailable.then === 'function') {
      result = await biometricsInstance.isSensorAvailable;
    }
    // Try legacy approach
    else {
      result = await biometricsInstance.isSensorAvailable();
    }
    
    console.log('📋 Biometrics check result:', result);
    return {
      available: result.available || false,
      biometryType: result.biometryType || '',
    };
  } catch (error) {
    console.error('❌ Error checking biometrics availability:', error);
    return {available: false, biometryType: ''};
  }
};

export const authenticateWithBiometrics = async (promptMessage = 'Authenticate') => {
  if (!biometricsInstance) {
    const initialized = await initializeBiometrics();
    if (!initialized) return {success: false, error: 'Biometrics not available'};
  }

  try {
    const {available} = await isBiometricsAvailable();
    if (!available) {
      return {success: false, error: 'Biometrics not available on device'};
    }

    let result;
    
    if (typeof biometricsInstance.simplePrompt === 'function') {
      result = await biometricsInstance.simplePrompt({
        promptMessage,
        cancelButtonText: 'Cancel',
      });
    } else if (biometricsInstance.simplePrompt && 
               typeof biometricsInstance.simplePrompt.then === 'function') {
      result = await biometricsInstance.simplePrompt;
    } else {
      return {success: false, error: 'Biometric prompt method not available'};
    }

    return {success: result.success, error: result.success ? null : 'Authentication failed'};
  } catch (error) {
    console.error('❌ Biometric authentication error:', error);
    return {success: false, error: error.message || 'Authentication failed'};
  }
};

export const isBiometricsEnabled = async () => {
  try {
    const enabled = await AsyncStorage.getItem('biometrics_enabled');
    return enabled === 'true';
  } catch (error) {
    console.error('Error checking biometrics enabled status:', error);
    return false;
  }
};

export const setBiometricsEnabled = async (enabled) => {
  try {
    await AsyncStorage.setItem('biometrics_enabled', enabled ? 'true' : 'false');
    return true;
  } catch (error) {
    console.error('Error setting biometrics enabled status:', error);
    return false;
  }
};