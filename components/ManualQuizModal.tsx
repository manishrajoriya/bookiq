import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { addQuiz } from '../services/historyStorage';

type QuizType = 'multiple-choice' | 'true-false' | 'fill-blank';

interface QuizQuestion {
  id: string;
  question: string;
  questionType: 'multiple-choice' | 'true-false';
  options: string[];
  correctAnswer: number;
}

interface ManualQuizModalProps {
  visible: boolean;
  onClose: () => void;
  onQuizSaved: () => void;
}

export default function ManualQuizModal({
  visible,
  onClose,
  onQuizSaved
}: ManualQuizModalProps) {
  const [manualQuizTitle, setManualQuizTitle] = useState('');
  const [manualQuizQuestions, setManualQuizQuestions] = useState<QuizQuestion[]>([{
    id: '1',
    question: '',
    questionType: 'multiple-choice',
    options: ['', '', '', ''],
    correctAnswer: 0
  }]);
  const [manualQuizType, setManualQuizType] = useState<QuizType>('multiple-choice');
  const [isSavingManualQuiz, setIsSavingManualQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');

  const closeModal = () => {
    if (isSavingManualQuiz) {
      Alert.alert(
        'Saving in Progress',
        'Please wait for the quiz to be saved.',
        [{ text: 'OK' }]
      );
      return;
    }
    onClose();
    setManualQuizTitle('');
    setManualQuizQuestions([{
      id: '1',
      question: '',
      questionType: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: 0
    }]);
    setManualQuizType('multiple-choice');
    setCurrentQuestionIndex(0);
  };

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: Date.now().toString(),
      question: '',
      questionType: 'multiple-choice',
      options: ['', '', '', ''],
      correctAnswer: 0
    };
    setManualQuizQuestions([...manualQuizQuestions, newQuestion]);
    setCurrentQuestionIndex(manualQuizQuestions.length);
  };

  const removeQuestion = (index: number) => {
    if (manualQuizQuestions.length <= 1) {
      Alert.alert('Error', 'You must have at least one question.');
      return;
    }
    const updatedQuestions = manualQuizQuestions.filter((_, i) => i !== index);
    setManualQuizQuestions(updatedQuestions);
    if (currentQuestionIndex >= updatedQuestions.length) {
      setCurrentQuestionIndex(updatedQuestions.length - 1);
    }
  };

  const updateQuestion = (index: number, field: keyof QuizQuestion, value: any) => {
    const updatedQuestions = [...manualQuizQuestions];
    if (field === 'options') {
      updatedQuestions[index] = { ...updatedQuestions[index], options: value };
    } else {
      updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    }
    setManualQuizQuestions(updatedQuestions);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuestions = [...manualQuizQuestions];
    updatedQuestions[questionIndex].options[optionIndex] = value;
    setManualQuizQuestions(updatedQuestions);
  };

  const setCorrectAnswer = (questionIndex: number, optionIndex: number) => {
    const updatedQuestions = [...manualQuizQuestions];
    updatedQuestions[questionIndex].correctAnswer = optionIndex;
    setManualQuizQuestions(updatedQuestions);
  };

  const updateQuestionType = (questionIndex: number, type: 'multiple-choice' | 'true-false') => {
    const updatedQuestions = [...manualQuizQuestions];
    updatedQuestions[questionIndex].questionType = type;
    
    // Reset options based on question type
    if (type === 'true-false') {
      updatedQuestions[questionIndex].options = ['True', 'False'];
      updatedQuestions[questionIndex].correctAnswer = 0; // Default to True
    } else {
      updatedQuestions[questionIndex].options = ['', '', '', ''];
      updatedQuestions[questionIndex].correctAnswer = 0;
    }
    
    setManualQuizQuestions(updatedQuestions);
  };

  const saveManualQuiz = async () => {
    if (!manualQuizTitle.trim()) {
      Alert.alert('Error', 'Please enter a quiz title.');
      return;
    }

    // Validate all questions
    for (let i = 0; i < manualQuizQuestions.length; i++) {
      const question = manualQuizQuestions[i];
      if (!question.question.trim()) {
        Alert.alert('Error', `Please enter a question for question ${i + 1}.`);
        return;
      }
      
      if (question.questionType === 'multiple-choice') {
        const validOptions = question.options.filter(option => option.trim() !== '');
        if (validOptions.length < 2) {
          Alert.alert('Error', `Question ${i + 1} must have at least 2 answer options.`);
          return;
        }
      }
    }

    try {
      setIsSavingManualQuiz(true);
      
      // Format quiz content
      let quizContent = '';
      manualQuizQuestions.forEach((q, index) => {
        quizContent += `${index + 1}. ${q.question}\n`;
        
        if (q.questionType === 'true-false') {
          quizContent += `   A) True\n`;
          quizContent += `   B) False\n`;
          quizContent += `   (Correct Answer: ${q.correctAnswer === 0 ? 'A) True' : 'B) False'})\n`;
        } else {
          q.options.forEach((option, optIndex) => {
            if (option.trim()) {
              const letter = String.fromCharCode(65 + optIndex); // A, B, C, D
              const isCorrect = optIndex === q.correctAnswer;
              quizContent += `   ${letter}) ${option}${isCorrect ? ' ✓' : ''}\n`;
            }
          });
        }
        quizContent += '\n';
      });
      
      quizContent += 'ANSWERS:\n';
      manualQuizQuestions.forEach((q, index) => {
        if (q.questionType === 'true-false') {
          const correctLetter = q.correctAnswer === 0 ? 'A' : 'B';
          const correctAnswer = q.correctAnswer === 0 ? 'True' : 'False';
          quizContent += `${index + 1}. ${correctLetter}) ${correctAnswer}\n`;
        } else {
          const correctLetter = String.fromCharCode(65 + q.correctAnswer);
          quizContent += `${index + 1}. ${correctLetter}) ${q.options[q.correctAnswer]}\n`;
        }
      });

      await addQuiz(
        manualQuizTitle.trim(),
        quizContent,
        'mixed', // Use 'mixed' for quizzes with different question types
        manualQuizQuestions.length
      );

      Alert.alert(
        'Success!', 
        'Quiz has been saved successfully.',
        [{ text: 'OK' }]
      );
      
      onQuizSaved();
      closeModal();
    } catch (error) {
      console.error('Failed to save manual quiz:', error);
      Alert.alert('Error', 'Failed to save quiz. Please try again.');
    } finally {
      setIsSavingManualQuiz(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={closeModal}
    >
      <SafeAreaView style={[styles.modalSafeAreView, { backgroundColor }]}>
        <View style={[styles.modalContainer, { backgroundColor }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <View style={styles.modalTitleContainer}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Create Custom Quiz</Text>
              <TouchableOpacity 
                onPress={closeModal}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Quiz Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: textColor }]}>Quiz Title</Text>
              <TextInput
                style={[styles.titleInput, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb', color: textColor }]}
                value={manualQuizTitle}
                onChangeText={setManualQuizTitle}
                placeholder="Enter quiz title..."
                placeholderTextColor="#9ca3af"
                returnKeyType="next"
              />
            </View>

            {/* Question Navigation */}
            <View style={styles.questionNavigation}>
              <Text style={[styles.navigationTitle, { color: textColor }]}>Questions ({manualQuizQuestions.length})</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.questionTabs}
              >
                {manualQuizQuestions.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.questionTab,
                      { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
                      currentQuestionIndex === index && { backgroundColor: '#f093fb', borderColor: '#f093fb' }
                    ]}
                    onPress={() => setCurrentQuestionIndex(index)}
                  >
                    <Text style={[
                      styles.questionTabText,
                      { color: '#4b5563' },
                      currentQuestionIndex === index && { color: 'white' }
                    ]}>
                      {index + 1}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.addQuestionTab}
                  onPress={addQuestion}
                >
                  <Ionicons name="add" size={20} color="#10b981" />
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Current Question */}
            {manualQuizQuestions.length > 0 && (
              <View style={[styles.questionSection, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }]}>
                <View style={styles.questionHeader}>
                  <Text style={[styles.questionNumber, { color: textColor }]}>Question {currentQuestionIndex + 1}</Text>
                  {manualQuizQuestions.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeQuestionButton}
                      onPress={() => removeQuestion(currentQuestionIndex)}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Question Type Selection */}
                <View style={styles.questionTypeSection}>
                  <Text style={[styles.inputLabel, { color: textColor }]}>Question Type</Text>
                  <View style={styles.questionTypeButtons}>
                    <TouchableOpacity
                      style={[
                        styles.questionTypeButton,
                        { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
                        manualQuizQuestions[currentQuestionIndex].questionType === 'multiple-choice' && 
                        { backgroundColor: '#f093fb', borderColor: '#f093fb' }
                      ]}
                      onPress={() => updateQuestionType(currentQuestionIndex, 'multiple-choice')}
                    >
                      <Ionicons 
                        name="list-outline" 
                        size={20} 
                        color={manualQuizQuestions[currentQuestionIndex].questionType === 'multiple-choice' ? '#fff' : '#6b7280'} 
                      />
                      <Text style={[
                        styles.questionTypeButtonText,
                        { color: '#6b7280' },
                        manualQuizQuestions[currentQuestionIndex].questionType === 'multiple-choice' && 
                        { color: 'white' }
                      ]}>
                        Multiple Choice
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.questionTypeButton,
                        { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
                        manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' && 
                        { backgroundColor: '#f093fb', borderColor: '#f093fb' }
                      ]}
                      onPress={() => updateQuestionType(currentQuestionIndex, 'true-false')}
                    >
                      <Ionicons 
                        name="checkmark-done-outline" 
                        size={20} 
                        color={manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' ? '#fff' : '#6b7280'} 
                      />
                      <Text style={[
                        styles.questionTypeButtonText,
                        { color: '#6b7280' },
                        manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' && 
                        { color: 'white' }
                      ]}>
                        True/False
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Question Text */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: textColor }]}>Question</Text>
                  <TextInput
                    style={[styles.questionInput, { backgroundColor: '#ffffff', borderColor: '#e5e7eb', color: textColor }]}
                    value={manualQuizQuestions[currentQuestionIndex].question}
                    onChangeText={(text) => updateQuestion(currentQuestionIndex, 'question', text)}
                    placeholder="Enter your question..."
                    placeholderTextColor="#9ca3af"
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Answer Options */}
                <View style={styles.optionsSection}>
                  <Text style={[styles.inputLabel, { color: textColor }]}>Answer Options</Text>
                  <Text style={[styles.optionsSubtitle, { color: iconColor }]}>
                    {manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' 
                      ? 'Tap the checkmark to mark the correct answer' 
                      : 'Tap the checkmark to mark the correct answer'
                    }
                  </Text>
                  
                  {manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' ? (
                    // True/False options
                    <>
                      <View style={[styles.optionContainer, { backgroundColor: '#ffffff', borderColor: '#e5e7eb' }]}>
                        <View style={styles.optionInputContainer}>
                          <Text style={styles.optionLetter}>A</Text>
                          <Text style={[styles.trueFalseOption, { color: textColor }]}>True</Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.correctAnswerButton,
                            { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
                            manualQuizQuestions[currentQuestionIndex].correctAnswer === 0 && 
                            { backgroundColor: '#10b981', borderColor: '#10b981' }
                          ]}
                          onPress={() => setCorrectAnswer(currentQuestionIndex, 0)}
                        >
                          <Ionicons 
                            name="checkmark" 
                            size={16} 
                            color={manualQuizQuestions[currentQuestionIndex].correctAnswer === 0 ? "#fff" : "#9ca3af"} 
                          />
                        </TouchableOpacity>
                      </View>
                      
                      <View style={[styles.optionContainer, { backgroundColor: '#ffffff', borderColor: '#e5e7eb' }]}>
                        <View style={styles.optionInputContainer}>
                          <Text style={styles.optionLetter}>B</Text>
                          <Text style={[styles.trueFalseOption, { color: textColor }]}>False</Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.correctAnswerButton,
                            { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
                            manualQuizQuestions[currentQuestionIndex].correctAnswer === 1 && 
                            { backgroundColor: '#10b981', borderColor: '#10b981' }
                          ]}
                          onPress={() => setCorrectAnswer(currentQuestionIndex, 1)}
                        >
                          <Ionicons 
                            name="checkmark" 
                            size={16} 
                            color={manualQuizQuestions[currentQuestionIndex].correctAnswer === 1 ? "#fff" : "#9ca3af"} 
                          />
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    // Multiple choice options
                    manualQuizQuestions[currentQuestionIndex].options.map((option, optionIndex) => (
                      <View key={optionIndex} style={[styles.optionContainer, { backgroundColor: '#ffffff', borderColor: '#e5e7eb' }]}>
                        <View style={styles.optionInputContainer}>
                          <Text style={styles.optionLetter}>
                            {String.fromCharCode(65 + optionIndex)}
                          </Text>
                          <TextInput
                            style={[styles.optionInput, { color: textColor }]}
                            value={option}
                            onChangeText={(text) => updateOption(currentQuestionIndex, optionIndex, text)}
                            placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                            placeholderTextColor="#9ca3af"
                          />
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.correctAnswerButton,
                            { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
                            manualQuizQuestions[currentQuestionIndex].correctAnswer === optionIndex && 
                            { backgroundColor: '#10b981', borderColor: '#10b981' }
                          ]}
                          onPress={() => setCorrectAnswer(currentQuestionIndex, optionIndex)}
                        >
                          <Ionicons 
                            name="checkmark" 
                            size={16} 
                            color={manualQuizQuestions[currentQuestionIndex].correctAnswer === optionIndex ? "#fff" : "#9ca3af"} 
                          />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[
                styles.saveButton,
                isSavingManualQuiz && styles.saveButtonDisabled
              ]}
              onPress={saveManualQuiz}
              disabled={isSavingManualQuiz}
            >
              {isSavingManualQuiz ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="white" />
                  <Text style={styles.saveButtonText}>Save Quiz</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalSafeAreView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 12 : 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  questionNavigation: {
    marginBottom: 24,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  questionTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  questionTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionTabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  addQuestionTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionSection: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 18,
    fontWeight: '600',
  },
  removeQuestionButton: {
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  questionTypeSection: {
    marginBottom: 24,
  },
  questionTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  questionTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  questionTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  questionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionsSection: {
    marginTop: 16,
  },
  optionsSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  optionInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionLetter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f093fb',
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  optionInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  trueFalseOption: {
    fontSize: 16,
    fontWeight: '500',
  },
  correctAnswerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  saveButton: {
    backgroundColor: '#f093fb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 