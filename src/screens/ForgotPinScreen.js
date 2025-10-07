import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {TextInput, Button, Card} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {NativeModules} from 'react-native';
import {useAlert} from '../contexts/AlertContext';

const {AppLockModule} = NativeModules;

const ForgotPinScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const {showAlert} = useAlert();
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
        showAlert(t('alerts.error'), t('forgot_pin.no_question_set'), 'error', [
          {
            text: t('common.ok'),
            onPress: () => navigation.goBack(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error checking security question:', error);
      setHasSecurityQuestion(false);
    }
  };

  const handleResetPassword = async () => {
    if (!answer.trim() || !newPassword || !confirmPassword) {
      showAlert(t('alerts.error'), t('errors.fill_all_fields'), 'error');
      return;
    }

    if (newPassword.length < 4) {
      showAlert(t('alerts.error'), t('errors.pin_too_short'), 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert(t('alerts.error'), t('errors.pins_not_match'), 'error');
      return;
    }

    setIsLoading(true);

    try {
      const savedAnswer = await AsyncStorage.getItem('security_answer');

      if (
        !savedAnswer ||
        savedAnswer.toLowerCase() !== answer.trim().toLowerCase()
      ) {
        showAlert(
          t('alerts.error'),
          t('errors.security_answer_incorrect'),
          'error',
        );
        setIsLoading(false);
        return;
      }

      await Keychain.setGenericPassword('applock_user', newPassword, {
        service: 'applock_service',
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      await AsyncStorage.removeItem('lockedApps');
      if (AppLockModule && typeof AppLockModule.setLockedApps === 'function') {
        await AppLockModule.setLockedApps([]);
      }

      showAlert(t('alerts.success'), t('forgot_pin.reset_success'), 'success', [
        {
          text: t('common.ok'),
          onPress: () => {
            navigation.navigate('Main', {screen: 'Home'});
          },
        },
      ]);
    } catch (error) {
      console.error('Error resetting password:', error);
      showAlert(t('alerts.error'), t('errors.reset_failed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasSecurityQuestion) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('forgot_pin.no_question_set')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>{t('forgot_pin.title')}</Text>
          <Text style={styles.subtitle}>{t('forgot_pin.subtitle')}</Text>

          <View style={styles.questionContainer}>
            <Text style={styles.questionLabel}>
              {t('forgot_pin.security_question')}
            </Text>
            <Text style={styles.questionText}>{securityQuestion}</Text>
          </View>

          <TextInput
            label={t('forgot_pin.your_answer')}
            value={answer}
            onChangeText={setAnswer}
            style={styles.input}
            mode="outlined"
            placeholder={t('forgot_pin.your_answer')}
          />

          <TextInput
            label={t('forgot_pin.new_pin')}
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
            label={t('forgot_pin.confirm_new_pin')}
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
            {t('forgot_pin.reset_pin')}
          </Button>

          <View style={styles.noteContainer}>
            <Text style={styles.noteTitle}>{t('common.note')}:</Text>
            <Text style={styles.noteText}>{t('forgot_pin.reset_note')}</Text>
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
