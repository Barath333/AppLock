import React, {useState} from 'react';
import {View, Text, StyleSheet, Alert} from 'react-native';
import {Button, TextInput} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import * as Keychain from 'react-native-keychain';

const SetupScreen = () => {
  const navigation = useNavigation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const handleSetupComplete = async () => {
    if (pin.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    try {
      // Store the PIN securely
      await Keychain.setGenericPassword('applock_pin', pin);
      navigation.navigate('Main', {screen: 'Home'});
    } catch (error) {
      Alert.alert('Error', 'Failed to save PIN');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set Up Your Security</Text>
      <Text style={styles.subtitle}>
        Create a secure PIN to protect your applications
      </Text>

      <TextInput
        label="Enter PIN"
        value={pin}
        onChangeText={setPin}
        secureTextEntry={!showPin}
        keyboardType="numeric"
        style={styles.input}
        maxLength={6}
        right={
          <TextInput.Icon
            name={showPin ? 'eye-off' : 'eye'}
            onPress={() => setShowPin(!showPin)}
          />
        }
      />

      <TextInput
        label="Confirm PIN"
        value={confirmPin}
        onChangeText={setConfirmPin}
        secureTextEntry={!showPin}
        keyboardType="numeric"
        style={styles.input}
        maxLength={6}
      />

      <Button
        mode="contained"
        onPress={handleSetupComplete}
        style={styles.button}
        disabled={pin.length < 4 || confirmPin.length < 4}>
        Complete Setup
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#6200ee',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  input: {
    marginBottom: 20,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 20,
    paddingVertical: 8,
    backgroundColor: '#6200ee',
  },
});

export default SetupScreen;
