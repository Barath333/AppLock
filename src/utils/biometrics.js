// utils/biometrics.js - SIMPLIFIED VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';

// We'll use a simpler approach since react-native-biometrics might have issues
export const initializeBiometrics = async () => {
  try {
    // Just return true for now - we'll check availability separately
    console.log('✅ Biometrics module initialization bypassed');
    return true;
  } catch (error) {
    console.warn('❌ Biometrics initialization error:', error.message);
    return false;
  }
};

export const isBiometricsAvailable = async () => {
  try {
    // Use a simpler approach - check if react-native-biometrics is available
    const biometricsModule = require('react-native-biometrics');
    
    if (biometricsModule) {
      let rnBiometrics;
      
      // Handle different export formats
      if (biometricsModule.default) {
        rnBiometrics = biometricsModule.default;
      } else if (biometricsModule.ReactNativeBiometrics) {
        rnBiometrics = biometricsModule.ReactNativeBiometrics;
      } else {
        rnBiometrics = biometricsModule;
      }
      
      // Create instance if needed
      const biometrics = typeof rnBiometrics === 'function' 
        ? new rnBiometrics({ allowDeviceCredentials: true })
        : rnBiometrics;
      
      // Check availability
      const result = await biometrics.isSensorAvailable();
      console.log('📋 Biometrics check result:', result);
      
      return {
        available: result.available || false,
        biometryType: result.biometryType || '',
      };
    }
    
    return { available: false, biometryType: '' };
  } catch (error) {
    console.error('❌ Error checking biometrics availability:', error);
    return { available: false, biometryType: '' };
  }
};

export const authenticateWithBiometrics = async (promptMessage = 'Authenticate') => {
  try {
    const biometricsModule = require('react-native-biometrics');
    
    let rnBiometrics;
    
    // Handle different export formats
    if (biometricsModule.default) {
      rnBiometrics = biometricsModule.default;
    } else if (biometricsModule.ReactNativeBiometrics) {
      rnBiometrics = biometricsModule.ReactNativeBiometrics;
    } else {
      rnBiometrics = biometricsModule;
    }
    
    // Create instance if needed
    const biometrics = typeof rnBiometrics === 'function' 
      ? new rnBiometrics({ allowDeviceCredentials: true })
      : rnBiometrics;
    
    // Simple prompt
    const result = await biometrics.simplePrompt({
      promptMessage,
      cancelButtonText: 'Cancel',
    });
    
    console.log('🔐 Biometric authentication result:', result);
    return { success: result.success, error: result.success ? null : 'Authentication failed' };
  } catch (error) {
    console.error('❌ Biometric authentication error:', error);
    return { success: false, error: error.message || 'Authentication failed' };
  }
};

export const isBiometricsEnabled = async () => {
  try {
    const enabled = await AsyncStorage.getItem('biometrics_enabled');
    console.log('📂 Reading biometrics_enabled from AsyncStorage:', enabled);
    return enabled === 'true';
  } catch (error) {
    console.error('Error reading biometrics enabled status:', error);
    return false;
  }
};

export const setBiometricsEnabled = async (enabled) => {
  try {
    console.log('💾 Setting biometrics_enabled to:', enabled);
    await AsyncStorage.setItem('biometrics_enabled', enabled ? 'true' : 'false');
    return true;
  } catch (error) {
    console.error('Error setting biometrics enabled status:', error);
    return false;
  }
};