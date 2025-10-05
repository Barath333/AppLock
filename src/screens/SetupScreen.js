import React, {useState, useRef} from 'react';
import {View, Text, StyleSheet, Alert, Animated, Easing} from 'react-native';
import {Button, TextInput} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import * as Keychain from 'react-native-keychain';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validatePINStrength } from '../utils/securityUtils';

const SetupScreen = () => {
  const navigation = useNavigation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinStrength, setPinStrength] = useState({ valid: true, message: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1)),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handlePinChange = (text) => {
    setPin(text);
    if (text.length >= 4) {
      const strength = validatePINStrength(text);
      setPinStrength(strength);
    } else {
      setPinStrength({ valid: true, message: '' });
    }
  };

  const handleSetupComplete = async () => {
    if (pin.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }

    // Check PIN strength
    const strengthCheck = validatePINStrength(pin);
    if (!strengthCheck.valid) {
      Alert.alert('Weak PIN', strengthCheck.message);
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    try {
      console.log('💾 Saving PIN to Keychain...');
      // Securely store the PIN using Keychain
      const result = await Keychain.setGenericPassword('applock_user', pin, {
        service: 'applock_service',
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      console.log('✅ PIN saved successfully:', result);

      // Mark setup as completed
      await AsyncStorage.setItem('setupCompleted', 'true');
      console.log('✅ Setup marked as completed');

      // Verify the PIN was saved
      const credentials = await Keychain.getGenericPassword({
        service: 'applock_service',
      });

      console.log('🔑 Verified stored PIN:', !!credentials);

      if (credentials && credentials.password === pin) {
        navigation.navigate('Main', {screen: 'Home'});
      } else {
        Alert.alert('Error', 'Failed to verify PIN storage. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error saving PIN:', error);
      Alert.alert('Error', 'Failed to save PIN. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {opacity: fadeAnim, transform: [{translateY: slideAnim}]},
        ]}>
        <View style={styles.iconContainer}>
          <Icon name="lock-plus" size={60} color="#1E88E5" />
        </View>

        <Text style={styles.title}>Set Up Your Security</Text>
        <Text style={styles.subtitle}>
          Create a secure PIN to protect your applications
        </Text>

        <TextInput
          label="Enter PIN (4-6 digits)"
          value={pin}
          onChangeText={handlePinChange}
          secureTextEntry={!showPin}
          keyboardType="numeric"
          style={styles.input}
          maxLength={6}
          mode="outlined"
          outlineColor="#E0E0E0"
          activeOutlineColor={pinStrength.valid ? '#1E88E5' : '#FF3B30'}
          right={
            <TextInput.Icon
              icon={showPin ? 'eye-off' : 'eye'}
              onPress={() => setShowPin(!showPin)}
              color="#1E88E5"
            />
          }
        />

        {!pinStrength.valid && (
          <Text style={styles.warningText}>⚠️ {pinStrength.message}</Text>
        )}

        <TextInput
          label="Confirm PIN"
          value={confirmPin}
          onChangeText={setConfirmPin}
          secureTextEntry={!showPin}
          keyboardType="numeric"
          style={styles.input}
          maxLength={6}
          mode="outlined"
          outlineColor="#E0E0E0"
          activeOutlineColor="#1E88E5"
        />

        <View style={styles.securityTips}>
          <Text style={styles.tipsTitle}>PIN Security Tips:</Text>
          <Text style={styles.tip}>• Use at least 4 digits</Text>
          <Text style={styles.tip}>• Avoid simple patterns like 1234</Text>
          <Text style={styles.tip}>• Don't use sequential numbers</Text>
          <Text style={styles.tip}>• Avoid repeated digits</Text>
          <Text style={styles.tip}>• Don't use your birth date</Text>
        </View>

        <Button
          mode="contained"
          onPress={handleSetupComplete}
          style={styles.button}
          disabled={pin.length < 4 || confirmPin.length < 4 || !pinStrength.valid}
          labelStyle={styles.buttonLabel}>
          Complete Setup
        </Button>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#42A5F5',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
    lineHeight: 22,
  },
  input: {
    marginBottom: 10,
    backgroundColor: 'white',
    width: '100%',
    fontSize: 16,
  },
  warningText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
  securityTips: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginVertical: 20,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E88E5',
    marginBottom: 8,
  },
  tip: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    marginLeft: 8,
  },
  button: {
    marginTop: 20,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#42A5F5',
    width: '100%',
    elevation: 4,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});

export default SetupScreen;