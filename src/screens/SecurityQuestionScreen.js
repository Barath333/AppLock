import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, ScrollView, Alert} from 'react-native';
import {TextInput, Button, Card, RadioButton} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SecurityQuestionScreen = () => {
  const navigation = useNavigation();
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [existingQuestion, setExistingQuestion] = useState(null);

  const securityQuestions = [
    "What was your first pet's name?",
    'What was the name of your elementary school?',
    "What is your mother's maiden name?",
    'What city were you born in?',
    'What was your childhood nickname?',
    'What is your favorite movie?',
    'Custom question (enter below)',
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

        // If it's a custom question, mark it as custom
        if (!securityQuestions.includes(savedQuestion)) {
          setSelectedQuestion('Custom question (enter below)');
          setCustomQuestion(savedQuestion);
        }
      }
    } catch (error) {
      console.error('Error loading security question:', error);
    }
  };

  const handleSave = async () => {
    if (!selectedQuestion) {
      Alert.alert('Error', 'Please select a security question');
      return;
    }

    let questionToSave = selectedQuestion;
    if (selectedQuestion === 'Custom question (enter below)') {
      if (!customQuestion.trim()) {
        Alert.alert('Error', 'Please enter your custom question');
        return;
      }
      questionToSave = customQuestion.trim();
    }

    if (!answer.trim()) {
      Alert.alert('Error', 'Please enter your answer');
      return;
    }

    setIsLoading(true);

    try {
      await AsyncStorage.setItem('security_question', questionToSave);
      await AsyncStorage.setItem(
        'security_answer',
        answer.trim().toLowerCase(),
      );

      Alert.alert('Success', 'Security question has been set up successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error saving security question:', error);
      Alert.alert('Error', 'Failed to save security question');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    Alert.alert(
      'Clear Security Question',
      'Are you sure you want to clear your security question?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('security_question');
              await AsyncStorage.removeItem('security_answer');
              setExistingQuestion(null);
              setSelectedQuestion('');
              setCustomQuestion('');
              setAnswer('');
              Alert.alert('Success', 'Security question has been cleared');
            } catch (error) {
              console.error('Error clearing security question:', error);
              Alert.alert('Error', 'Failed to clear security question');
            }
          },
          style: 'destructive',
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>Security Question</Text>
          <Text style={styles.subtitle}>
            Set up a security question to recover your PIN if you forget it
          </Text>

          {existingQuestion && (
            <View style={styles.existingContainer}>
              <Text style={styles.existingTitle}>Current Question:</Text>
              <Text style={styles.existingQuestion}>
                {existingQuestion.question}
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>Select a Security Question</Text>

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

          {selectedQuestion === 'Custom question (enter below)' && (
            <TextInput
              label="Your Custom Question"
              value={customQuestion}
              onChangeText={setCustomQuestion}
              style={styles.input}
              mode="outlined"
              placeholder="Enter your custom security question"
            />
          )}

          <TextInput
            label="Your Answer"
            value={answer}
            onChangeText={setAnswer}
            style={styles.input}
            mode="outlined"
            placeholder="Enter your answer"
            secureTextEntry
          />

          <Button
            mode="contained"
            onPress={handleSave}
            style={styles.saveButton}
            loading={isLoading}
            disabled={isLoading}>
            {existingQuestion
              ? 'Update Security Question'
              : 'Save Security Question'}
          </Button>

          {existingQuestion && (
            <Button
              mode="outlined"
              onPress={handleClear}
              style={styles.clearButton}
              textColor="#FF3B30">
              Clear Security Question
            </Button>
          )}
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
