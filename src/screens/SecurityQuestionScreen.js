// SecurityQuestionScreen.js - Fixed keyboard handling without measure()
import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  UIManager,
  findNodeHandle,
} from 'react-native';
import {
  TextInput,
  Button,
  Card,
  RadioButton,
  Portal,
  Dialog,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAlert} from '../contexts/AlertContext';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';


// Enable layout animations for Android
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const SecurityQuestionScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  
  const [mode, setMode] = useState('view'); // 'view', 'verify', 'edit'
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState(''); // For verification
  const [isLoading, setIsLoading] = useState(false);
  const [existingQuestion, setExistingQuestion] = useState(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [verificationError, setVerificationError] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const isMandatory = route.params?.mandatory || false;
  const backHandlerRef = useRef(null);
  const scrollViewRef = useRef(null);

  const securityQuestions = [
    t('security_question.pet_name'),
    t('security_question.elementary_school'),
    t('security_question.mother_maiden'),
    t('security_question.birth_city'),
    t('security_question.childhood_nickname'),
    t('security_question.favorite_movie'),
    t('security_question.custom_question'),
  ];

  useEffect(() => {
    loadExistingQuestion();
    
    // Handle back button for mandatory mode
    if (isMandatory) {
      backHandlerRef.current = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          setShowExitDialog(true);
          return true;
        }
      );
    }

    // Keyboard listeners
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      if (backHandlerRef.current) {
        backHandlerRef.current.remove();
      }
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [isMandatory]);

  const loadExistingQuestion = async () => {
    try {
      const savedQuestion = await AsyncStorage.getItem('security_question');
      const savedAnswer = await AsyncStorage.getItem('security_answer');

      if (savedQuestion && savedAnswer) {
        setExistingQuestion({
          question: savedQuestion,
          answer: savedAnswer,
        });
        
        // If we're in mandatory mode and question exists, go to view mode
        if (isMandatory) {
          setMode('view');
        } else {
          setMode('view');
        }
      } else {
        // No existing question, go to edit mode
        setMode('edit');
      }
    } catch (error) {
      console.error('Error loading security question:', error);
      setMode('edit');
    }
  };

  const handleVerifyAnswer = async () => {
    if (!currentAnswer.trim()) {
      setVerificationError(t('errors.enter_current_answer'));
      return;
    }

    try {
      const savedAnswer = await AsyncStorage.getItem('security_answer');
      
      if (currentAnswer.trim().toLowerCase() === savedAnswer?.toLowerCase()) {
        setVerificationError('');
        setCurrentAnswer('');
        setMode('edit');
        
        // Pre-select existing question if it's in the list
        if (existingQuestion) {
          if (securityQuestions.includes(existingQuestion.question)) {
            setSelectedQuestion(existingQuestion.question);
          } else {
            setSelectedQuestion(t('security_question.custom_question'));
            setCustomQuestion(existingQuestion.question);
          }
        }
      } else {
        setVerificationError(t('errors.incorrect_security_answer'));
      }
    } catch (error) {
      console.error('Error verifying answer:', error);
      setVerificationError(t('errors.verification_failed'));
    }
  };

  const handleSave = async () => {
    if (!selectedQuestion) {
      showAlert(t('alerts.error'), t('errors.select_question'), 'error');
      return;
    }

    let questionToSave = selectedQuestion;
    if (selectedQuestion === t('security_question.custom_question')) {
      if (!customQuestion.trim()) {
        showAlert(
          t('alerts.error'),
          t('errors.enter_custom_question'),
          'error',
        );
        return;
      }
      questionToSave = customQuestion.trim();
    }

    if (!answer.trim()) {
      showAlert(t('alerts.error'), t('errors.enter_answer'), 'error');
      return;
    }

    setIsLoading(true);

    try {
      await AsyncStorage.setItem('security_question', questionToSave);
      await AsyncStorage.setItem(
        'security_answer',
        answer.trim().toLowerCase(),
      );

      // Reload existing question
      await loadExistingQuestion();
      
      showAlert(
        t('alerts.success'),
        existingQuestion ? t('security_question.update_success') : t('security_question.save_success'),
        'success',
        [
          {
            text: t('common.ok'),
            onPress: () => {
              if (isMandatory) {
                navigation.goBack();
              }
            },
          },
        ],
      );
      
      // Reset form
      setAnswer('');
      if (!existingQuestion) {
        setSelectedQuestion('');
        setCustomQuestion('');
      }
    } catch (error) {
      console.error('Error saving security question:', error);
      showAlert(t('alerts.error'), t('errors.save_failed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  // View mode - shows existing question and update button
  const renderViewMode = () => (
    <View>
      <View style={styles.existingContainer}>
        <Text style={styles.existingTitle}>
          {t('security_question.current_question')}
        </Text>
        <Text style={styles.existingQuestion}>
          {existingQuestion.question}
        </Text>
      </View>
      
      <Button
        mode="outlined"
        onPress={() => setMode('verify')}
        style={styles.updateButton}
        icon="lock-reset">
        {t('security_question.update_question')}
      </Button>
    </View>
  );

  // Verify mode - asks for current answer
  const renderVerifyMode = () => (
    <View>
      <View style={styles.existingContainer}>
        <Text style={styles.existingTitle}>
          {t('security_question.current_question')}
        </Text>
        <Text style={styles.existingQuestion}>
          {existingQuestion.question}
        </Text>
      </View>
      
      <Text style={styles.verificationText}>
        {t('security_question.verify_instructions')}
      </Text>
      
      <TextInput
        label={t('security_question.current_answer')}
        value={currentAnswer}
        onChangeText={(text) => {
          setCurrentAnswer(text);
          setVerificationError('');
        }}
        style={styles.input}
        mode="outlined"
        placeholder={t('security_question.answer_placeholder')}
        secureTextEntry
        error={!!verificationError}
      />
      
      {verificationError ? (
        <Text style={styles.errorText}>{verificationError}</Text>
      ) : null}
      
      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          onPress={() => setMode('view')}
          style={styles.cancelButton}
          textColor="#666">
          {t('common.cancel')}
        </Button>
        <Button
          mode="contained"
          onPress={handleVerifyAnswer}
          style={styles.verifyButton}>
          {t('security_question.verify_and_continue')}
        </Button>
      </View>
    </View>
  );

  // Edit mode - shows question list and answer input
  const renderEditMode = () => (
    <View>
      <Text style={styles.sectionTitle}>
        {existingQuestion 
          ? t('security_question.select_new_question')
          : t('security_question.select_question')}
      </Text>

      <RadioButton.Group
        onValueChange={setSelectedQuestion}
        value={selectedQuestion}>
        {securityQuestions.map((question, index) => (
          <View key={index} style={styles.radioContainer}>
            <RadioButton value={question} color="#1E88E5" />
            <Text style={styles.radioLabel}>{question}</Text>
          </View>
        ))}
      </RadioButton.Group>

      {selectedQuestion === t('security_question.custom_question') && (
        <TextInput
          label={t('security_question.custom_label')}
          value={customQuestion}
          onChangeText={setCustomQuestion}
          style={styles.input}
          mode="outlined"
          placeholder={t('security_question.custom_placeholder')}
        />
      )}

      <TextInput
        label={t('security_question.your_answer')}
        value={answer}
        onChangeText={setAnswer}
        style={styles.input}
        mode="outlined"
        placeholder={t('security_question.answer_placeholder')}
        secureTextEntry
      />

      <Button
        mode="contained"
        onPress={handleSave}
        style={styles.saveButton}
        loading={isLoading}
        disabled={isLoading}
        icon={existingQuestion ? "lock-check" : "lock"}>
        {existingQuestion
          ? t('security_question.update_question')
          : t('security_question.save_question')}
      </Button>

      {existingQuestion && (
        <Button
          mode="text"
          onPress={() => setMode('view')}
          style={styles.cancelEditButton}
          textColor="#666">
          {t('common.cancel')}
        </Button>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 160}>
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View style={styles.container}>
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: keyboardHeight + 20 } // Add extra padding when keyboard is open
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag">
            <Card style={styles.card}>
              <Card.Content>
                {isMandatory && (
                  <View style={styles.mandatoryHeader}>
                    <Icon name="shield-alert" size={24} color="#1E88E5" />
                    <Text style={styles.mandatoryText}>
                      {t('security_question.mandatory_title')}
                    </Text>
                  </View>
                )}

                <Text style={styles.title}>
                  {isMandatory 
                    ? t('security_question.mandatory_setup_title')
                    : t('security_question.title')}
                </Text>
                
                <Text style={styles.subtitle}>
                  {isMandatory
                    ? t('security_question.mandatory_subtitle')
                    : t('security_question.subtitle')}
                </Text>

                {/* Render based on current mode */}
                {mode === 'view' && existingQuestion && renderViewMode()}
                {mode === 'verify' && renderVerifyMode()}
                {mode === 'edit' && renderEditMode()}
              </Card.Content>
            </Card>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* Exit Dialog for mandatory mode */}
      <Portal>
        <Dialog
          visible={showExitDialog}
          onDismiss={() => setShowExitDialog(false)}>
          <Dialog.Title>{t('security_question.exit_title')}</Dialog.Title>
          <Dialog.Content>
            <Text>{t('security_question.exit_message')}</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowExitDialog(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onPress={() => {
                setShowExitDialog(false);
                navigation.goBack();
              }}
              textColor="#FF3B30">
              {t('common.exit')}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  card: {
    borderRadius: 12,
    elevation: 4,
    marginBottom: 20,
  },
  mandatoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  mandatoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E88E5',
    marginLeft: 8,
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
  existingContainer: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  existingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E88E5',
    marginBottom: 4,
  },
  existingQuestion: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  updateButton: {
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 8,
    borderColor: '#1E88E5',
  },
  verificationText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginBottom: 16,
    marginLeft: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
    borderRadius: 8,
  },
  verifyButton: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: '#1E88E5',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingRight: 8,
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginLeft: 8,
    flexWrap: 'wrap',
  },
  input: {
    marginBottom: 20,
    backgroundColor: 'white',
  },
  saveButton: {
    marginTop: 10,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#1E88E5',
  },
  cancelEditButton: {
    borderRadius: 8,
  },
});

export default SecurityQuestionScreen;