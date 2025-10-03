import React, {useState} from 'react';
import {View, Text, StyleSheet, ScrollView, Alert} from 'react-native';
import {TextInput, Button, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import * as Keychain from 'react-native-keychain';

const ChangePasswordScreen = () => {
  const navigation = useNavigation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 4) {
      Alert.alert('Error', 'New PIN must be at least 4 digits');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New PINs do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Verify current password
      const credentials = await Keychain.getGenericPassword({
        service: 'applock_service',
      });

      if (!credentials || credentials.password !== currentPassword) {
        Alert.alert('Error', 'Current PIN is incorrect');
        setIsLoading(false);
        return;
      }

      // Update to new password
      await Keychain.setGenericPassword('applock_user', newPassword, {
        service: 'applock_service',
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      Alert.alert('Success', 'PIN has been changed successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Error', 'Failed to change PIN');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Change Master PIN</Text>
          <Text style={styles.subtitle}>
            Update your security PIN to keep your apps protected
          </Text>

          <TextInput
            label="Current PIN"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showCurrentPassword}
            keyboardType="numeric"
            style={styles.input}
            mode="outlined"
            maxLength={6}
            right={
              <TextInput.Icon
                icon={showCurrentPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                color="#1E88E5"
              />
            }
          />

          <TextInput
            label="New PIN (4-6 digits)"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            keyboardType="numeric"
            style={styles.input}
            mode="outlined"
            maxLength={6}
            right={
              <TextInput.Icon
                icon={showNewPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowNewPassword(!showNewPassword)}
                color="#1E88E5"
              />
            }
          />

          <TextInput
            label="Confirm New PIN"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            keyboardType="numeric"
            style={styles.input}
            mode="outlined"
            maxLength={6}
            right={
              <TextInput.Icon
                icon={showConfirmPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                color="#1E88E5"
              />
            }
          />

          <Button
            mode="contained"
            onPress={handleChangePassword}
            style={styles.button}
            loading={isLoading}
            disabled={isLoading}>
            Change PIN
          </Button>

          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>PIN Security Tips:</Text>
            <Text style={styles.tip}>• Use at least 4 digits</Text>
            <Text style={styles.tip}>• Avoid simple patterns like 1234</Text>
            <Text style={styles.tip}>• Don't use your birth date</Text>
            <Text style={styles.tip}>• Change your PIN regularly</Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  card: {
    borderRadius: 12,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#1E88E5',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
    lineHeight: 20,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: '#1E88E5',
  },
  tipsContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
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
});

export default ChangePasswordScreen;
