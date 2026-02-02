// ForgotPinResetScreen.js
import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import {TextInput, Button, Card, HelperText} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {useAlert} from '../contexts/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const {width} = Dimensions.get('window');

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.iconContainer}>
            <Icon name="lock-reset" size={80} color="#1E88E5" />
          </View>
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

        {/* Step Indicator */}
        <View style={styles.stepIndicatorContainer}>
          <View style={styles.stepWrapper}>
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle, 
                step >= 1 && styles.stepCircleActive
              ]}>
                <Text style={[
                  styles.stepNumber,
                  step >= 1 && styles.stepNumberActive
                ]}>1</Text>
              </View>
              <Text style={[
                styles.stepLabel,
                step >= 1 && styles.stepLabelActive
              ]}>
                {t('forgot_pin.verify_answer')}
              </Text>
            </View>
            
            <View style={[
              styles.stepConnector,
              step >= 2 && styles.stepConnectorActive
            ]} />
            
            <View style={styles.stepItem}>
              <View style={[
                styles.stepCircle, 
                step >= 2 && styles.stepCircleActive
              ]}>
                <Text style={[
                  styles.stepNumber,
                  step >= 2 && styles.stepNumberActive
                ]}>2</Text>
              </View>
              <Text style={[
                styles.stepLabel,
                step >= 2 && styles.stepLabelActive
              ]}>
                {t('forgot_pin.set_pin')}
              </Text>
            </View>
          </View>
        </View>

        {/* Content Card */}
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            
            {/* Step 1: Security Question */}
            {step === 1 && (
              <View style={styles.stepContent}>
                <View style={styles.questionSection}>
                  <Text style={styles.sectionTitle}>
                    {t('forgot_pin.your_security_question')}
                  </Text>
                  
                  {securityQuestion ? (
                    <Card style={styles.questionCard} mode="contained">
                      <Card.Content>
                        <Text style={styles.questionText}>{securityQuestion}</Text>
                      </Card.Content>
                    </Card>
                  ) : (
                    <View style={styles.warningContainer}>
                      <Icon name="alert-circle-outline" size={24} color="#FF6B6B" />
                      <Text style={styles.warningText}>
                        {t('forgot_pin.no_security_question_set')}
                      </Text>
                    </View>
                  )}
                </View>

                <TextInput
                  label={t('forgot_pin.enter_your_answer')}
                  value={securityAnswer}
                  onChangeText={setSecurityAnswer}
                  style={styles.input}
                  mode="outlined"
                  placeholder={t('forgot_pin.answer_placeholder')}
                  secureTextEntry
                  outlineColor="#E0E0E0"
                  activeOutlineColor="#1E88E5"
                  theme={{ roundness: 10 }}
                />

                {error ? (
                  <View style={styles.errorContainer}>
                    <HelperText type="error" style={styles.errorText}>
                      {error}
                    </HelperText>
                  </View>
                ) : null}

                <View style={styles.buttonContainer}>
                  <Button
                    mode="contained"
                    onPress={verifySecurityAnswer}
                    style={styles.primaryButton}
                    loading={isLoading}
                    disabled={isLoading || !securityAnswer.trim()}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}>
                    {t('forgot_pin.verify_and_continue')}
                  </Button>

                  {/* <Button
                    mode="text"
                    onPress={() => navigation.navigate('SecurityQuestion')}
                    style={styles.linkButton}
                    textColor="#1E88E5"
                    labelStyle={styles.linkButtonLabel}>
                    {t('forgot_pin.set_security_question')}
                  </Button> */}
                </View>
              </View>
            )}

            {/* Step 2: New PIN */}
            {step === 2 && (
              <View style={styles.stepContent}>
                <Text style={styles.instructionText}>
                  {t('forgot_pin.new_pin_instruction')}
                </Text>

                <View style={styles.inputGroup}>
                  <TextInput
                    label={t('setup.enter_pin')}
                    value={newPin}
                    onChangeText={setNewPin}
                    style={styles.pinInput}
                    mode="outlined"
                    keyboardType="numeric"
                    maxLength={6}
                    secureTextEntry={!showPin}
                    outlineColor="#E0E0E0"
                    activeOutlineColor="#1E88E5"
                    theme={{ roundness: 10 }}
                    left={<TextInput.Icon icon="lock" size={20} />}
                    right={
                      <TextInput.Icon
                        icon={showPin ? 'eye-off' : 'eye'}
                        onPress={() => setShowPin(!showPin)}
                        forceTextInputFocus={false}
                      />
                    }
                  />

                  <TextInput
                    label={t('setup.confirm_pin')}
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    style={styles.pinInput}
                    mode="outlined"
                    keyboardType="numeric"
                    maxLength={6}
                    secureTextEntry={!showPin}
                    outlineColor="#E0E0E0"
                    activeOutlineColor="#1E88E5"
                    theme={{ roundness: 10 }}
                    left={<TextInput.Icon icon="lock-check" size={20} />}
                    right={
                      <TextInput.Icon
                        icon={showPin ? 'eye-off' : 'eye'}
                        onPress={() => setShowPin(!showPin)}
                        forceTextInputFocus={false}
                      />
                    }
                  />
                </View>

                {error ? (
                  <View style={styles.errorContainer}>
                    <HelperText type="error" style={styles.errorText}>
                      {error}
                    </HelperText>
                  </View>
                ) : null}

                <View style={styles.actionButtons}>
                  <Button
                    mode="outlined"
                    onPress={() => setStep(1)}
                    style={styles.secondaryButton}
                    textColor="#666"
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}>
                    {t('common.back')}
                  </Button>
                  <Button
                    mode="contained"
                    onPress={resetPin}
                    style={styles.primaryButton}
                    loading={isLoading}
                    disabled={isLoading || !newPin || !confirmPin}
                    contentStyle={styles.buttonContent}
                    labelStyle={styles.buttonLabel}>
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
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#BBDEFB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1A237E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  stepIndicatorContainer: {
    marginBottom: 30,
  },
  stepWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  stepCircleActive: {
    backgroundColor: '#1E88E5',
    borderColor: '#0D47A1',
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  stepNumberActive: {
    color: '#FFF',
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#1E88E5',
  },
  stepConnector: {
    flex: 1,
    height: 3,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
  },
  stepConnectorActive: {
    backgroundColor: '#1E88E5',
  },
  card: {
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    backgroundColor: '#FFF',
    marginBottom: 20,
  },
  cardContent: {
    padding: 24,
  },
  stepContent: {
    width: '100%',
  },
  questionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingLeft: 4,
  },
  questionCard: {
    backgroundColor: '#F3F8FF',
    borderWidth: 1,
    borderColor: '#D1E3FF',
    borderRadius: 12,
  },
  questionText: {
    fontSize: 16,
    color: '#1E88E5',
    textAlign: 'center',
    paddingVertical: 12,
    fontWeight: '500',
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  warningText: {
    fontSize: 14,
    color: '#FF6B6B',
    marginLeft: 12,
    flex: 1,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'white',
    fontSize: 16,
  },
  pinInput: {
    marginBottom: 16,
    backgroundColor: 'white',
    fontSize: 16,
  },
  inputGroup: {
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  buttonContainer: {
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    backgroundColor: '#1E88E5',
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  secondaryButton: {
    borderRadius: 12,
    borderColor: '#666',
    borderWidth: 1,
    flex: 1,
  },
  linkButton: {
    marginTop: 16,
  },
  buttonContent: {
    height: 52,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default ForgotPinResetScreen;