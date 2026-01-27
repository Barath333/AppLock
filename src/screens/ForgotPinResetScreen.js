// ForgotPinResetScreen.js
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {TextInput, Button, Card, HelperText} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {useAlert} from '../contexts/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const ForgotPinResetScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  
  const [step, setStep] = useState(1); // 1: Security question, 2: New PIN
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSecurityQuestion();
  }, []);

  const loadSecurityQuestion = async () => {
    try {
      const question = await AsyncStorage.getItem('security_question');
      setSecurityQuestion(question || '');
    } catch (error) {
      console.error('Error loading security question:', error);
      showAlert(t('alerts.error'), t('errors.load_security_question_failed'), 'error');
    }
  };

  const verifySecurityAnswer = async () => {
    if (!securityAnswer.trim()) {
      setError(t('errors.enter_security_answer'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const savedAnswer = await AsyncStorage.getItem('security_answer');
      
      if (!savedAnswer) {
        setError(t('errors.security_question_not_set'));
        return;
      }

      if (securityAnswer.trim().toLowerCase() === savedAnswer.toLowerCase()) {
        // Answer is correct, proceed to step 2
        setStep(2);
        setSecurityAnswer('');
        setError('');
      } else {
        setError(t('errors.incorrect_security_answer'));
      }
    } catch (error) {
      console.error('Error verifying security answer:', error);
      setError(t('errors.verification_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const resetPin = async () => {
    // Validate PIN
    if (newPin.length < 4) {
      setError(t('errors.pin_too_short'));
      return;
    }

    if (newPin !== confirmPin) {
      setError(t('errors.pin_mismatch'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Save new PIN to Keychain
      await Keychain.setGenericPassword('applock_user', newPin, {
        service: 'applock_service',
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });

      // Clear failed attempts
      await AsyncStorage.multiRemove(['failed_attempts', 'lock_until']);

      showAlert(
        t('alerts.success'),
        t('forgot_pin.reset_success'),
        'success',
        [
          {
            text: t('common.ok'),
            onPress: () => {
        navigation.navigate('Main', {screen: 'Home'});
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error resetting PIN:', error);
      setError(t('errors.reset_pin_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.header}>
              <Icon name="lock-reset" size={48} color="#1E88E5" />
              <Text style={styles.title}>
                {step === 1
                  ? t('forgot_pin.reset_password')
                  : t('forgot_pin.set_new_pin')}
              </Text>
              <Text style={styles.subtitle}>
                {step === 1
                  ? t('forgot_pin.security_question_required')
                  : t('forgot_pin.enter_new_pin')}
              </Text>
            </View>

            {/* Step indicator */}
            <View style={styles.stepIndicator}>
              <View style={[styles.step, step === 1 && styles.activeStep]}>
                <Text style={[styles.stepText, step === 1 && styles.activeStepText]}>
                  1
                </Text>
                <Text style={styles.stepLabel}>{t('forgot_pin.verify_answer')}</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={[styles.step, step === 2 && styles.activeStep]}>
                <Text style={[styles.stepText, step === 2 && styles.activeStepText]}>
                  2
                </Text>
                <Text style={styles.stepLabel}>{t('forgot_pin.set_pin')}</Text>
              </View>
            </View>

            {/* Step 1: Security Question */}
            {step === 1 && (
              <View style={styles.stepContainer}>
                {securityQuestion ? (
                  <View style={styles.questionContainer}>
                    <Text style={styles.questionLabel}>
                      {t('forgot_pin.your_security_question')}
                    </Text>
                    <Card style={styles.questionCard}>
                      <Card.Content>
                        <Text style={styles.questionText}>{securityQuestion}</Text>
                      </Card.Content>
                    </Card>
                  </View>
                ) : (
                  <Text style={styles.noQuestionText}>
                    {t('forgot_pin.no_security_question_set')}
                  </Text>
                )}

                <TextInput
                  label={t('forgot_pin.enter_your_answer')}
                  value={securityAnswer}
                  onChangeText={setSecurityAnswer}
                  style={styles.input}
                  mode="outlined"
                  placeholder={t('forgot_pin.answer_placeholder')}
                  secureTextEntry
                />

                {error ? <HelperText type="error">{error}</HelperText> : null}

                <Button
                  mode="contained"
                  onPress={verifySecurityAnswer}
                  style={styles.button}
                  loading={isLoading}
                  disabled={isLoading || !securityAnswer.trim()}>
                  {t('forgot_pin.verify_and_continue')}
                </Button>

                <Button
                  mode="text"
                  onPress={() => navigation.navigate('SecurityQuestion')}
                  style={styles.secondaryButton}
                  textColor="#1E88E5">
                  {t('forgot_pin.set_security_question')}
                </Button>
              </View>
            )}

            {/* Step 2: New PIN */}
            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={styles.instruction}>
                  {t('forgot_pin.new_pin_instruction')}
                </Text>

                <TextInput
                  label={t('setup.enter_pin')}
                  value={newPin}
                  onChangeText={setNewPin}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry={!showPin}
                  right={
                    <TextInput.Icon
                      icon={showPin ? 'eye-off' : 'eye'}
                      onPress={() => setShowPin(!showPin)}
                    />
                  }
                />

                <TextInput
                  label={t('setup.confirm_pin')}
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  style={styles.input}
                  mode="outlined"
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry={!showPin}
                  right={
                    <TextInput.Icon
                      icon={showPin ? 'eye-off' : 'eye'}
                      onPress={() => setShowPin(!showPin)}
                    />
                  }
                />

                {error ? <HelperText type="error">{error}</HelperText> : null}

                <View style={styles.buttonRow}>
                  <Button
                    mode="outlined"
                    onPress={() => setStep(1)}
                    style={styles.backButton}
                    textColor="#666">
                    {t('common.back')}
                  </Button>
                  <Button
                    mode="contained"
                    onPress={resetPin}
                    style={styles.button}
                    loading={isLoading}
                    disabled={isLoading || !newPin || !confirmPin}>
                    {t('forgot_pin.reset_pin')}
                  </Button>
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
  },
  card: {
    borderRadius: 12,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
    color: '#1E88E5',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
    lineHeight: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStep: {
    backgroundColor: '#1E88E5',
  },
  stepText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  activeStepText: {
    color: '#FFF',
  },
  stepLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    width: 80,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 8,
  },
  stepContainer: {
    marginTop: 10,
  },
  questionContainer: {
    marginBottom: 20,
  },
  questionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  questionCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  questionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    padding: 8,
  },
  noQuestionText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  button: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#1E88E5',
  },
  secondaryButton: {
    marginTop: 12,
  },
  backButton: {
    flex: 1,
    marginRight: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
});

export default ForgotPinResetScreen;