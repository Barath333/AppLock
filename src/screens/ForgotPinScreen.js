import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, Alert} from 'react-native';
import {TextInput, Button, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules} from 'react-native';

const {AppLockModule} = NativeModules;

const ForgotPinScreen = () => {
  const navigation = useNavigation();
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false);

  useEffect(() => {
    checkSecurityQuestion();
  }, []);

  const checkSecurityQuestion = async () => {
    try {
      const question = await AsyncStorage.getItem('security_question');
      const savedAnswer = await AsyncStorage.getItem('security_answer');

      if (question && savedAnswer) {
        setSecurityQuestion(question);
        setHasSecurityQuestion(true);
      } else {
        setHasSecurityQuestion(false);
        Alert.alert(
          'No Security Question',
          'You have not set up a security question. Please set one up in Settings to use this feature.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ],
        );
      }
    } catch (error) {
      console.error('Error checking security question:', error);
      setHasSecurityQuestion(false);
    }
  };

  const handleResetPassword = async () => {
    if (!answer.trim() || !newPassword || !confirmPassword) {
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
      // Verify security answer
      const savedAnswer = await AsyncStorage.getItem('security_answer');

      if (
        !savedAnswer ||
        savedAnswer.toLowerCase() !== answer.trim().toLowerCase()
      ) {
        Alert.alert('Error', 'Security answer is incorrect');
        setIsLoading(false);
        return;
      }

      // Reset the PIN in Keychain
      await Keychain.setGenericPassword('applock_user', newPassword, {
        service: 'applock_service',
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      // Clear locked apps
      await AsyncStorage.removeItem('lockedApps');
      if (AppLockModule && typeof AppLockModule.setLockedApps === 'function') {
        await AppLockModule.setLockedApps([]);
      }

      Alert.alert(
        'Success',
        'PIN has been reset successfully. All apps have been unlocked.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('Main', {screen: 'Home'});
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', 'Failed to reset PIN');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasSecurityQuestion) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Security question not set up. Please set it up in Settings.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Forgot PIN</Text>
          <Text style={styles.subtitle}>
            Answer your security question to reset your PIN
          </Text>

          <View style={styles.questionContainer}>
            <Text style={styles.questionLabel}>Security Question:</Text>
            <Text style={styles.questionText}>{securityQuestion}</Text>
          </View>

          <TextInput
            label="Your Answer"
            value={answer}
            onChangeText={setAnswer}
            style={styles.input}
            mode="outlined"
            placeholder="Enter your answer"
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
            onPress={handleResetPassword}
            style={styles.button}
            loading={isLoading}
            disabled={isLoading}>
            Reset PIN
          </Button>

          <View style={styles.noteContainer}>
            <Text style={styles.noteTitle}>Note:</Text>
            <Text style={styles.noteText}>
              Resetting your PIN will unlock all currently locked apps for
              security reasons.
            </Text>
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
  questionContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E88E5',
    marginBottom: 4,
  },
  questionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
  noteContainer: {
    backgroundColor: '#FFF3E0',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: '#E65100',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 20,
    padding: 16,
  },
});

export default ForgotPinScreen;
