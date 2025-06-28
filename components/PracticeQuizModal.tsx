import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';

interface PracticeQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  questionType: 'multiple-choice' | 'true-false';
}

interface PracticeState {
  questions: PracticeQuestion[];
  currentQuestionIndex: number;
  userAnswers: number[];
  showAnswers: boolean;
  score: number;
  isComplete: boolean;
  mode: 'per-question' | 'all-at-once';
  checked: boolean;
}

interface PracticeQuizModalProps {
  visible: boolean;
  onClose: () => void;
  quiz: {
    id: number;
    title: string;
    content: string;
    quiz_type: string;
    source_note_id?: number;
    source_note_type?: string;
    createdAt: string;
  } | null;
}

export default function PracticeQuizModal({
  visible,
  onClose,
  quiz
}: PracticeQuizModalProps) {
  const [practiceState, setPracticeState] = useState<PracticeState>({
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: [],
    showAnswers: false,
    score: 0,
    isComplete: false,
    mode: 'per-question',
    checked: false,
  });
  const [practiceStartTime, setPracticeStartTime] = useState<number | null>(null);
  const [practiceEndTime, setPracticeEndTime] = useState<number | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');

  const closeModal = () => {
    onClose();
    setPracticeState({
      questions: [],
      currentQuestionIndex: 0,
      userAnswers: [],
      showAnswers: false,
      score: 0,
      isComplete: false,
      mode: 'per-question',
      checked: false,
    });
    setPracticeStartTime(null);
    setPracticeEndTime(null);
    setReviewMode(false);
  };

  const parseQuizContent = (content: string): PracticeQuestion[] => {
    const questions: PracticeQuestion[] = [];
    const lines = content.split('\n');
    let currentQuestion: PracticeQuestion | null = null;
    for (const line of lines) {
      const trimmedLine = line.trim();
      // Stop parsing if we reach the ANSWERS section
      if (/^ANSWERS:?$/i.test(trimmedLine)) {
        break;
      }
      // Check if it's a question (starts with number and dot)
      if (/^\d+\./.test(trimmedLine)) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        const questionText = trimmedLine.replace(/^\d+\.\s*/, '');
        currentQuestion = {
          question: questionText,
          options: [],
          correctAnswer: 0,
          questionType: 'multiple-choice'
        };
      }
      // Check if it's an option (starts with letter and parenthesis)
      else if (currentQuestion && /^[A-D]\)/.test(trimmedLine)) {
        const optionText = trimmedLine.replace(/^[A-D]\)\s*/, '');
        const optionIndex = trimmedLine.charCodeAt(0) - 65; // A=0, B=1, etc.
        currentQuestion.options[optionIndex] = optionText;
        // Check if it's marked as correct (has ✓)
        if (optionText.includes('✓')) {
          currentQuestion.correctAnswer = optionIndex;
          currentQuestion.options[optionIndex] = optionText.replace(' ✓', '');
        }
        // Determine if it's true/false based on options
        if (currentQuestion.options.length >= 2 && 
            currentQuestion.options[0] === 'True' && 
            currentQuestion.options[1] === 'False') {
          currentQuestion.questionType = 'true-false';
        }
      }
    }
    if (currentQuestion) {
      questions.push(currentQuestion);
    }
    return questions;
  };

  const startPractice = (questionsOverride?: PracticeQuestion[]) => {
    if (!quiz) return;
    const questions = questionsOverride || parseQuizContent(quiz.content);
    setPracticeState({
      questions,
      currentQuestionIndex: 0,
      userAnswers: new Array(questions.length).fill(-1),
      showAnswers: false,
      score: 0,
      isComplete: false,
      mode: 'per-question',
      checked: false,
    });
    setPracticeStartTime(Date.now());
    setPracticeEndTime(null);
    setReviewMode(false);
  };

  const selectAnswer = (answerIndex: number) => {
    setPracticeState(prev => ({
      ...prev,
      userAnswers: prev.userAnswers.map((answer, index) => 
        index === prev.currentQuestionIndex ? answerIndex : answer
      )
    }));
  };

  const nextQuestion = () => {
    setPracticeState(prev => {
      if (prev.currentQuestionIndex < prev.questions.length - 1) {
        return {
          ...prev,
          currentQuestionIndex: prev.currentQuestionIndex + 1
        };
      } else {
        // Calculate final score
        const score = prev.userAnswers.reduce((total, answer, index) => {
          return total + (answer === prev.questions[index].correctAnswer ? 1 : 0);
        }, 0);
        setPracticeEndTime(Date.now());
        return {
          ...prev,
          isComplete: true,
          score
        };
      }
    });
  };

  const previousQuestion = () => {
    setPracticeState(prev => ({
      ...prev,
      currentQuestionIndex: Math.max(0, prev.currentQuestionIndex - 1)
    }));
  };

  const showAnswer = () => {
    setPracticeState(prev => ({
      ...prev,
      showAnswers: true,
      checked: true,
      // For all-at-once mode, calculate score now
      score: prev.mode === 'all-at-once' ? prev.userAnswers.reduce((total, answer, index) => {
        return total + (answer === prev.questions[index].correctAnswer ? 1 : 0);
      }, 0) : prev.score
    }));
  };

  const hideAnswer = () => {
    setPracticeState(prev => ({
      ...prev,
      showAnswers: false
    }));
  };

  const restartPractice = () => {
    if (!quiz) return;
    startPractice();
  };

  const retakeIncorrectOnly = () => {
    if (!quiz) return;
    const incorrectQuestions = practiceState.questions.filter((q, i) => practiceState.userAnswers[i] !== q.correctAnswer);
    if (incorrectQuestions.length === 0) return;
    setReviewMode(false);
    startPractice(incorrectQuestions);
  };

  // Initialize practice when modal opens
  React.useEffect(() => {
    if (visible && quiz && practiceState.questions.length === 0) {
      startPractice();
    }
  }, [visible, quiz]);

  if (!quiz) return null;

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
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {practiceState.isComplete ? 'Quiz Complete!' : 'Practice Quiz'}
              </Text>
              <TouchableOpacity 
                onPress={closeModal}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.selectedNoteTitle, { color: iconColor }]}>
              {quiz.title}
            </Text>
          </View>

          {practiceState.isComplete ? (
            reviewMode ? (
              // Review Screen
              <ScrollView style={{flex: 1, padding: 16}}>
                <Text style={[styles.reviewTitle, { color: textColor }]}>Review Answers</Text>
                {practiceState.questions.map((q, i) => {
                  const userAnswer = practiceState.userAnswers[i];
                  const isCorrect = userAnswer === q.correctAnswer;
                  return (
                    <View key={i} style={[
                      styles.reviewQuestion,
                      { backgroundColor: '#fff', borderColor: isCorrect ? '#10b981' : '#ef4444' }
                    ]}>
                      <Text style={[styles.reviewQuestionText, { color: textColor }]}>{i+1}. {q.question}</Text>
                      {q.options.map((opt, idx) => (
                        <View key={idx} style={styles.reviewOption}>
                          <Text style={[
                            styles.reviewOptionLetter,
                            { color: idx === q.correctAnswer ? '#10b981' : '#374151' }
                          ]}>
                            {String.fromCharCode(65+idx)}) 
                          </Text>
                          <Text style={[
                            styles.reviewOptionText,
                            { color: idx === userAnswer ? (isCorrect ? '#10b981' : '#ef4444') : '#374151' }
                          ]}>
                            {opt}
                          </Text>
                          {idx === q.correctAnswer && <Ionicons name="checkmark-circle" size={16} color="#10b981" style={{marginLeft: 4}} />}
                          {idx === userAnswer && userAnswer !== q.correctAnswer && <Ionicons name="close-circle" size={16} color="#ef4444" style={{marginLeft: 4}} />}
                        </View>
                      ))}
                      <Text style={[
                        styles.reviewAnswer,
                        { color: isCorrect ? '#10b981' : '#ef4444' }
                      ]}>
                        Your answer: {userAnswer !== -1 ? String.fromCharCode(65+userAnswer) : 'None'} ({isCorrect ? 'Correct' : 'Incorrect'})
                      </Text>
                    </View>
                  );
                })}
                <TouchableOpacity style={[styles.actionButton, {marginTop: 16}]} onPress={() => setReviewMode(false)}>
                  <Ionicons name="arrow-back" size={20} color="white" />
                  <Text style={styles.actionButtonText}>Back to Results</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              // Results Screen
              <View style={styles.resultsContainer}>
                <View style={styles.resultsHeader}>
                  <Ionicons 
                    name={practiceState.score === practiceState.questions.length ? "trophy" : "star"} 
                    size={80} 
                    color={practiceState.score === practiceState.questions.length ? "#fbbf24" : "#10b981"} 
                  />
                  <Text style={[styles.resultsTitle, { color: textColor }]}>
                    {practiceState.score === practiceState.questions.length ? "Perfect Score!" : "Great Job!"}
                  </Text>
                  <Text style={[styles.resultsScore, { color: iconColor }]}>
                    {practiceState.score} / {practiceState.questions.length} Correct
                  </Text>
                  {/* Score breakdown */}
                  <Text style={[styles.resultsPercentage, { color: iconColor }]}>
                    {Math.round((practiceState.score / practiceState.questions.length) * 100)}%
                  </Text>
                  <Text style={[styles.resultsPercentage, { color: iconColor }]}>
                    Incorrect: {practiceState.questions.length - practiceState.score}
                  </Text>
                  <Text style={[styles.resultsPercentage, { color: iconColor }]}>
                    Skipped: {practiceState.userAnswers.filter(a => a === -1).length}
                  </Text>
                  {/* Time taken */}
                  {practiceStartTime && practiceEndTime && (
                    <Text style={[styles.resultsPercentage, { color: iconColor }]}>
                      Time: {Math.round((practiceEndTime - practiceStartTime)/1000)}s
                    </Text>
                  )}
                </View>
                <View style={styles.resultsActions}>
                  <TouchableOpacity
                    style={styles.restartButton}
                    onPress={restartPractice}
                  >
                    <Ionicons name="refresh-outline" size={20} color="white" />
                    <Text style={styles.restartButtonText}>Try Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.restartButton, {backgroundColor: '#6366f1', marginTop: 12}]}
                    onPress={() => setReviewMode(true)}
                  >
                    <Ionicons name="eye-outline" size={20} color="white" />
                    <Text style={styles.restartButtonText}>Review Answers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.restartButton, {backgroundColor: '#ef4444', marginTop: 12}]}
                    onPress={retakeIncorrectOnly}
                    disabled={practiceState.questions.filter((q, i) => practiceState.userAnswers[i] !== q.correctAnswer).length === 0}
                  >
                    <Ionicons name="repeat-outline" size={20} color="white" />
                    <Text style={styles.restartButtonText}>Retake Incorrect Only</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          ) : (
            // Question Screen
            <View style={styles.practiceContent}>
              {/* Progress Bar */}
              <View style={styles.progressSection}>
                <Text style={[styles.progressText, { color: textColor }]}>
                  Question {practiceState.currentQuestionIndex + 1} of {practiceState.questions.length}
                </Text>
                <View style={styles.progressBarContainer}>
                  <View 
                    style={[
                      styles.progressBar,
                      { width: `${((practiceState.currentQuestionIndex + 1) / practiceState.questions.length) * 100}%` }
                    ]} 
                  />
                </View>
              </View>

              {/* Question */}
              <View style={styles.questionContainer}>
                <Text style={[styles.questionText, { color: textColor }]}>
                  {practiceState.questions[practiceState.currentQuestionIndex]?.question}
                </Text>
              </View>

              {/* Options */}
              <View style={styles.optionsContainer}>
                {practiceState.questions[practiceState.currentQuestionIndex]?.options.map((option, index) => {
                  const isSelected = practiceState.userAnswers[practiceState.currentQuestionIndex] === index;
                  const isCorrect = index === practiceState.questions[practiceState.currentQuestionIndex]?.correctAnswer;
                  const showCorrect = practiceState.showAnswers;
                  let optionStyle = [styles.optionButton, { borderColor: '#e5e7eb' }];
                  if (isSelected && showCorrect) {
                    optionStyle = isCorrect ? [styles.optionButtonCorrect, { borderColor: '#10b981',  }] : [styles.optionButtonIncorrect, { borderColor: '#ef4444',  }];
                  } else if (showCorrect && isCorrect) {
                    optionStyle = [styles.optionButtonCorrect, { borderColor: '#10b981',  }];
                  } else if (isSelected) {
                    optionStyle = [styles.optionButtonSelected, { borderColor: '#f093fb', }];
                  }
                  return (
                    <TouchableOpacity
                      key={index}
                      style={optionStyle}
                      onPress={() => selectAnswer(index)}
                      disabled={practiceState.showAnswers}
                    >
                      <Text style={styles.optionLetter}>
                        {String.fromCharCode(65 + index)}
                      </Text>
                      <Text style={[styles.optionText, { color: textColor }]}>{option}</Text>
                      {showCorrect && isCorrect && (
                        <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                      )}
                      {showCorrect && isSelected && !isCorrect && (
                        <Ionicons name="close-circle" size={20} color="#ef4444" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action Buttons */}
              <View style={styles.practiceActions}>
                {/* Show Answer button (optional) */}
                {!practiceState.showAnswers && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      practiceState.userAnswers[practiceState.currentQuestionIndex] === -1 && styles.actionButtonDisabled
                    ]}
                    onPress={showAnswer}
                    disabled={practiceState.userAnswers[practiceState.currentQuestionIndex] === -1}
                  >
                    <Ionicons name="eye-outline" size={20} color="white" />
                    <Text style={styles.actionButtonText}>Show Answer</Text>
                  </TouchableOpacity>
                )}
                {/* Next/Finish always available after answer selected */}
                <View style={styles.navigationButtons}>
                  <TouchableOpacity
                    style={[
                      styles.navButton,
                      { backgroundColor: '#f0f0ff' },
                      practiceState.currentQuestionIndex === 0 && styles.navButtonDisabled
                    ]}
                    onPress={previousQuestion}
                    disabled={practiceState.currentQuestionIndex === 0}
                  >
                    <Ionicons name="chevron-back" size={20} color="#6b7280" />
                    <Text style={[styles.navButtonText, { color: '#6b7280' }]}>Previous</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.navButton,
                      { backgroundColor: '#f0f0ff' },
                      practiceState.userAnswers[practiceState.currentQuestionIndex] === -1 && styles.navButtonDisabled
                    ]}
                    onPress={nextQuestion}
                    disabled={practiceState.userAnswers[practiceState.currentQuestionIndex] === -1}
                  >
                    <Text style={[styles.navButtonText, { color: '#6b7280' }]}>
                      {practiceState.currentQuestionIndex === practiceState.questions.length - 1 ? 'Finish' : 'Next'}
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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
  selectedNoteTitle: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  practiceContent: {
    flex: 1,
    padding: 40,
  },
  progressSection: {
    marginBottom: 24,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#f093fb',
    borderRadius: 2,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionButtonCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionButtonIncorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderRadius: 8,
    marginBottom: 8,
  },
  optionButtonSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderRadius: 8,
    marginBottom: 8,
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
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  practiceActions: {
    marginTop: 24,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#f093fb',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  actionButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  resultsHeader: {
    marginBottom: 24,
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  resultsScore: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  resultsPercentage: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  resultsActions: {
    marginTop: 24,
    width: '100%',
  },
  restartButton: {
    backgroundColor: '#10b981',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  reviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  reviewQuestion: {
    marginBottom: 20,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  reviewQuestionText: {
    fontWeight: '600',
    marginBottom: 8,
  },
  reviewOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reviewOptionLetter: {
    fontWeight: '600',
  },
  reviewOptionText: {
    flex: 1,
  },
  reviewAnswer: {
    marginTop: 4,
    fontWeight: '500',
  },
}); 