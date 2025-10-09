import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {TextInput, Button, Card, RadioButton} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useAlert} from '../contexts/AlertContext';
import CustomKeyboardAvoidingView from '../components/KeyboardAvoidingView';

const SecurityQuestionScreen = () => {
  const navigation = useNavigation();
  const {t} = useTranslation();
  const {showAlert} = useAlert();
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingQuestion, setExistingQuestion] = useState(null);

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
  }, []);

  const loadExistingQuestion = async () => {
    try {
      const savedQuestion = await AsyncStorage.getItem('security_question');
      const savedAnswer = await AsyncStorage.getItem('security_answer');

      if (savedQuestion && savedAnswer) {
        setExistingQuestion({
          question: savedQuestion,
          answer: savedAnswer,
        });
        setSelectedQuestion(savedQuestion);

        if (!securityQuestions.includes(savedQuestion)) {
          setSelectedQuestion(t('security_question.custom_question'));
          setCustomQuestion(savedQuestion);
        }
      }
    } catch (error) {
      console.error('Error loading security question:', error);
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

      showAlert(
        t('alerts.success'),
        t('security_question.save_success'),
        'success',
        [
          {
            text: t('common.ok'),
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.error('Error saving security question:', error);
      showAlert(t('alerts.error'), t('errors.save_failed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    showAlert(
      t('security_question.clear_title'),
      t('security_question.clear_confirm'),
      'warning',
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('security_question.clear_button'),
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('security_question');
              await AsyncStorage.removeItem('security_answer');
              setExistingQuestion(null);
              setSelectedQuestion('');
              setCustomQuestion('');
              setAnswer('');
              showAlert(
                t('alerts.success'),
                t('security_question.clear_success'),
                'success',
              );
            } catch (error) {
              console.error('Error clearing security question:', error);
              showAlert(t('alerts.error'), t('errors.clear_failed'), 'error');
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  return (
    <CustomKeyboardAvoidingView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>{t('security_question.title')}</Text>
          <Text style={styles.subtitle}>{t('security_question.subtitle')}</Text>

          {existingQuestion && (
            <View style={styles.existingContainer}>
              <Text style={styles.existingTitle}>
                {t('security_question.current_question')}
              </Text>
              <Text style={styles.existingQuestion}>
                {existingQuestion.question}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>
            {t('security_question.select_question')}
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
            disabled={isLoading}>
            {existingQuestion
              ? t('security_question.update_question')
              : t('security_question.save_question')}
          </Button>

          {existingQuestion && (
            <Button
              mode="outlined"
              onPress={handleClear}
              style={styles.clearButton}
              textColor="#FF3B30">
              {t('security_question.clear_question')}
            </Button>
          )}
        </Card.Content>
      </Card>
    </CustomKeyboardAvoidingView>
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
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    marginLeft: 8,
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
  clearButton: {
    borderRadius: 8,
    borderColor: '#FF3B30',
  },
});

export default SecurityQuestionScreen;
