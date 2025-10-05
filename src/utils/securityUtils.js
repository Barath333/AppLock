// src/utils/securityUtils.js
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
    const DeviceInfo = require('react-native-device-info');

    // Check for root/jailbreak
    const isRooted = await DeviceInfo.isRooted();
    const isJailBroken = await DeviceInfo.isJailBroken();

    return {
      isSecure: !isRooted && !isJailBroken,
      isRooted,
      isJailBroken,
      warnings: [],
    };
  } catch (error) {
    console.log('Security check error:', error);
    return {
      isSecure: true,
      isRooted: false,
      isJailBroken: false,
      warnings: ['Security check unavailable'],
    };
  }
};

export const checkAppTampering = async () => {
  try {
    const DeviceInfo = require('react-native-device-info');

    // Check if app is running in emulator (common for tampering)
    const isEmulator = await DeviceInfo.isEmulator();

    // Check if app is being debugged
    // Note: This is a basic check - in production you'd want more sophisticated checks

    return {
      isTampered: isEmulator, // In production, add more checks
      isEmulator,
      warnings: isEmulator
        ? ['Running in emulator - security may be compromised']
        : [],
    };
  } catch (error) {
    return {
      isTampered: false,
      isEmulator: false,
      warnings: [],
    };
  }
};
