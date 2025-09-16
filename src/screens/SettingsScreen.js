// src/screens/SettingsScreen.js
import React, {useState} from 'react';
import {View, Text, StyleSheet, ScrollView, Alert, Switch} from 'react-native';
import {List, Button, Divider} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import * as Keychain from 'react-native-keychain';
import * as Biometrics from 'react-native-biometrics';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Check biometrics availability on component mount
  React.useEffect(() => {
    checkBiometricsAvailability();
  }, []);

  const checkBiometricsAvailability = async () => {
    try {
      const {available} = await Biometrics.isSensorAvailable();
      setBiometricsEnabled(available);
    } catch (error) {
      console.error('Error checking biometrics:', error);
    }
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleToggleBiometrics = async value => {
    if (value) {
      try {
        // Prompt user to authenticate with biometrics
        const {success} = await Biometrics.simplePrompt({
          promptMessage: 'Authenticate to enable biometrics',
        });

        if (success) {
          setBiometricsEnabled(true);
          Alert.alert('Success', 'Biometric authentication enabled');
        } else {
          Alert.alert('Error', 'Biometric authentication failed');
        }
      } catch (error) {
        console.error('Error enabling biometrics:', error);
        Alert.alert('Error', 'Failed to enable biometric authentication');
      }
    } else {
      setBiometricsEnabled(false);
      Alert.alert(
        'Biometrics Disabled',
        'Biometric authentication has been disabled',
      );
    }
  };

  const handleSecurityQuestion = () => {
    navigation.navigate('SecurityQuestion');
  };

  const handleUpgradeToPremium = () => {
    navigation.navigate('Premium');
  };

  const handleContactSupport = () => {
    // This would open email client or support form
    Alert.alert('Contact Support', 'Support email: support@applock.com');
  };

  const handleAbout = () => {
    navigation.navigate('About');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <List.Section>
        <List.Subheader>Security</List.Subheader>
        <List.Item
          title="Change Master Password"
          description="Update your security PIN"
          left={props => <List.Icon {...props} icon="lock" />}
          onPress={handleChangePassword}
        />
        <List.Item
          title="Biometric Authentication"
          description="Use fingerprint to unlock apps"
          left={props => <List.Icon {...props} icon="fingerprint" />}
          right={() => (
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              color="#6200ee"
            />
          )}
        />
        <List.Item
          title="Security Question"
          description="Set up PIN recovery question"
          left={props => <List.Icon {...props} icon="help-circle" />}
          onPress={handleSecurityQuestion}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader>Premium</List.Subheader>
        <List.Item
          title={isPremium ? 'Premium Activated' : 'Upgrade to Premium'}
          description={
            isPremium
              ? 'Thank you for your support!'
              : 'Remove ads and get extra features'
          }
          left={props => (
            <List.Icon
              {...props}
              icon="crown"
              color={isPremium ? 'gold' : '#6200ee'}
            />
          )}
          onPress={handleUpgradeToPremium}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader>Support</List.Subheader>
        <List.Item
          title="Contact Support"
          description="Get help with the app"
          left={props => <List.Icon {...props} icon="headset" />}
          onPress={handleContactSupport}
        />
        <List.Item
          title="About"
          description="App version and information"
          left={props => <List.Icon {...props} icon="information" />}
          onPress={handleAbout}
        />
      </List.Section>

      <View style={styles.footer}>
        <Text style={styles.version}>App Lock v1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#6200ee',
  },
  divider: {
    marginVertical: 10,
    marginHorizontal: 16,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  version: {
    color: '#666',
    fontSize: 14,
  },
});

export default SettingsScreen;
