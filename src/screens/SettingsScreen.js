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

  // Update the handleToggleBiometrics function
  const handleToggleBiometrics = async value => {
    if (value) {
      try {
        // Check if biometrics is available
        const {available} = await Biometrics.isSensorAvailable();

        if (!available) {
          Alert.alert(
            'Not Available',
            'Biometric authentication is not available on this device',
          );
          return;
        }

        const {success} = await Biometrics.simplePrompt({
          promptMessage: 'Authenticate to enable biometrics',
        });

        if (success) {
          await AsyncStorage.setItem('biometrics_enabled', 'true');
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
      await AsyncStorage.setItem('biometrics_enabled', 'false');
      setBiometricsEnabled(false);
      Alert.alert(
        'Biometrics Disabled',
        'Biometric authentication has been disabled',
      );
    }
  };

  // const handleToggleBiometrics = async value => {
  //   if (value) {
  //     try {
  //       const {success} = await Biometrics.simplePrompt({
  //         promptMessage: 'Authenticate to enable biometrics',
  //       });

  //       if (success) {
  //         setBiometricsEnabled(true);
  //         Alert.alert('Success', 'Biometric authentication enabled');
  //       } else {
  //         Alert.alert('Error', 'Biometric authentication failed');
  //       }
  //     } catch (error) {
  //       console.error('Error enabling biometrics:', error);
  //       Alert.alert('Error', 'Failed to enable biometric authentication');
  //     }
  //   } else {
  //     setBiometricsEnabled(false);
  //     Alert.alert(
  //       'Biometrics Disabled',
  //       'Biometric authentication has been disabled',
  //     );
  //   }
  // };

  const handleSecurityQuestion = () => {
    navigation.navigate('SecurityQuestion');
  };

  const handleUpgradeToPremium = () => {
    navigation.navigate('Premium');
  };

  const handleContactSupport = () => {
    Alert.alert('Contact Support', 'Support email: support@applock.com');
  };

  const handleAbout = () => {
    navigation.navigate('About');
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>Security</List.Subheader>
        <List.Item
          title="Change Master Password"
          description="Update your security PIN"
          left={props => <List.Icon {...props} icon="lock" color="#1E88E5" />}
          onPress={handleChangePassword}
        />
        <List.Item
          title="Biometric Authentication"
          description="Use fingerprint to unlock apps"
          left={props => (
            <List.Icon {...props} icon="fingerprint" color="#1E88E5" />
          )}
          right={() => (
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              thumbColor={biometricsEnabled ? '#1E88E5' : '#f4f3f4'}
              trackColor={{false: '#767577', true: '#BBDEFB'}}
            />
          )}
        />
        <List.Item
          title="Security Question"
          description="Set up PIN recovery question"
          left={props => (
            <List.Icon {...props} icon="help-circle" color="#1E88E5" />
          )}
          onPress={handleSecurityQuestion}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>Premium</List.Subheader>
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
              color={isPremium ? '#FFD700' : '#1E88E5'}
            />
          )}
          onPress={handleUpgradeToPremium}
        />
      </List.Section>

      <Divider style={styles.divider} />

      <List.Section>
        <List.Subheader style={styles.sectionHeader}>Support</List.Subheader>
        <List.Item
          title="Contact Support"
          description="Get help with the app"
          left={props => (
            <List.Icon {...props} icon="headset" color="#1E88E5" />
          )}
          onPress={handleContactSupport}
        />
        <List.Item
          title="About"
          description="App version and information"
          left={props => (
            <List.Icon {...props} icon="information" color="#1E88E5" />
          )}
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
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#1E88E5',
  },
  sectionHeader: {
    color: '#1E88E5',
    fontWeight: '600',
  },
  divider: {
    marginVertical: 10,
    marginHorizontal: 16,
    backgroundColor: '#E0E0E0',
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
