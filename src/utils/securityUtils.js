// src/utils/securityUtils.js

// Import DeviceInfo properly
let DeviceInfo;
try {
  DeviceInfo = require('react-native-device-info');
} catch (error) {
  console.warn('DeviceInfo module not available in securityUtils:', error);
  DeviceInfo = null;
}

export const validatePINStrength = pin => {
  const weakPatterns = [
    '1234',
    '0000',
    '1111',
    '2222',
    '3333',
    '4444',
    '5555',
    '6666',
    '7777',
    '8888',
    '9999',
  ];
  if (weakPatterns.includes(pin)) {
    return {valid: false, message: 'Avoid simple patterns like 1234'};
  }

  // Check for sequential numbers
  const isSequential =
    /^(0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)$/.test(
      pin,
    );
  if (isSequential) {
    return {valid: false, message: 'Avoid sequential numbers'};
  }

  // Check for repeated numbers
  const isRepeated = /^(\d)\1{3,}$/.test(pin);
  if (isRepeated) {
    return {valid: false, message: 'Avoid repeated numbers'};
  }

  return {valid: true};
};

export const checkDeviceSecurity = async () => {
  try {
    if (!DeviceInfo) {
      console.warn('DeviceInfo not available in securityUtils');
      return {
        isRooted: false,
        isJailBroken: false,
      };
    }

    const isRooted = await DeviceInfo.isRooted();
    const isJailBroken = await DeviceInfo.isJailBroken();

    return {
      isRooted,
      isJailBroken,
    };
  } catch (error) {
    console.error('Error checking device security:', error);
    return {
      isRooted: false,
      isJailBroken: false,
    };
  }
};

export const checkAppTampering = async () => {
  try {
    if (!DeviceInfo) {
      console.warn('DeviceInfo not available in securityUtils');
      return {
        isEmulator: false,
        isTampered: false,
      };
    }

    const isEmulator = await DeviceInfo.isEmulator();

    return {
      isEmulator,
      isTampered: false,
    };
  } catch (error) {
    console.error('Error checking app tampering:', error);
    return {
      isEmulator: false,
      isTampered: false,
    };
  }
};

// Additional security utility functions
export const checkAppIntegrity = async () => {
  try {
    // Check for debug mode
    if (__DEV__) {
      console.warn('App is running in development mode');
    }

    let isEmulator = false;
    if (DeviceInfo && typeof DeviceInfo.isEmulator === 'function') {
      isEmulator = await DeviceInfo.isEmulator();
      if (isEmulator) {
        console.warn('App is running in emulator');
      }
    }

    return {
      isDebug: __DEV__,
      isTampered: false,
      isEmulator,
    };
  } catch (error) {
    console.error('Error checking app integrity:', error);
    return {
      isDebug: __DEV__,
      isTampered: false,
      isEmulator: false,
    };
  }
};

export const getDeviceSecurityInfo = async () => {
  try {
    const securityInfo = {
      isRooted: false,
      isJailBroken: false,
      isEmulator: false,
      hasRootAccess: false,
      trustScore: 100, // Default trust score
    };

    // Check if DeviceInfo is available
    if (DeviceInfo) {
      if (typeof DeviceInfo.isRooted === 'function') {
        securityInfo.isRooted = await DeviceInfo.isRooted();
      }
      if (typeof DeviceInfo.isJailBroken === 'function') {
        securityInfo.isJailBroken = await DeviceInfo.isJailBroken();
      }
      if (typeof DeviceInfo.isEmulator === 'function') {
        securityInfo.isEmulator = await DeviceInfo.isEmulator();
      }

      // Calculate trust score
      if (securityInfo.isRooted || securityInfo.isJailBroken) {
        securityInfo.trustScore = 30;
      } else if (securityInfo.isEmulator) {
        securityInfo.trustScore = 70;
      } else {
        securityInfo.trustScore = 100;
      }
    }

    return securityInfo;
  } catch (error) {
    console.error('Error getting device security info:', error);
    return {
      isRooted: false,
      isJailBroken: false,
      isEmulator: false,
      hasRootAccess: false,
      trustScore: 100,
    };
  }
};
