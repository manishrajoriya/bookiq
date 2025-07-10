import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    Platform,
    ScrollView,
    StatusBar,
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
  mode: 'exam' | 'practice' | 'preview';
  checked: boolean;
  showModeSelector: boolean;
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
    mode: 'practice',
    checked: false,
    showModeSelector: true,
  });
  const [practiceStartTime, setPracticeStartTime] = useState<number | null>(null);
  const [practiceEndTime, setPracticeEndTime] = useState<number | null>(null);
  const [reviewMode, setReviewMode] = useState(false);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');
  
  // Theme-aware color variants for better visual comfort
  const isDark = backgroundColor === '#0f0f0f' || backgroundColor === '#151718';
  const softBackground = isDark ? '#1a1a1a' : '#f8f9fa';
  const softerBackground = isDark ? '#2a2a2a' : '#f5f5f5';
  const mutedBackground = isDark ? '#333333' : '#fafafa';
  const cardBackground = isDark ? '#1a1a1a' : '#f8f9fa';

  const closeModal = () => {
    onClose();
    setPracticeState({
      questions: [],
      currentQuestionIndex: 0,
      userAnswers: [],
      showAnswers: false,
      score: 0,
      isComplete: false,
      mode: 'practice',
      checked: false,
      showModeSelector: true,
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
      mode: 'practice',
      checked: false,
      showModeSelector: true,
    });
    setPracticeStartTime(null);
    setPracticeEndTime(null);
    setReviewMode(false);
  };

  const selectMode = (mode: 'exam' | 'practice' | 'preview') => {
    setPracticeState(prev => ({
      ...prev,
      mode,
      showModeSelector: false,
      showAnswers: mode === 'preview' ? true : false,
    }));
    if (mode !== 'preview') {
      setPracticeStartTime(Date.now());
    }
  };

  const goBackToModeSelector = () => {
    setPracticeState(prev => ({
      ...prev,
      showModeSelector: true,
      showAnswers: false,
      isComplete: false,
      currentQuestionIndex: 0,
      userAnswers: new Array(prev.questions.length).fill(-1),
    }));
    setPracticeStartTime(null);
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
        // Handle completion based on mode
        if (prev.mode === 'preview') {
          // For preview mode, just mark as complete without scoring
          setPracticeEndTime(Date.now());
          return {
            ...prev,
            isComplete: true,
            score: -1 // -1 indicates preview mode (no score)
          };
        } else {
          // Calculate final score for practice modes
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
      // For exam mode, calculate score now
      score: prev.mode === 'exam' ? prev.userAnswers.reduce((total, answer, index) => {
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
      const questions = parseQuizContent(quiz.content);
      setPracticeState({
        questions,
        currentQuestionIndex: 0,
        userAnswers: new Array(questions.length).fill(-1),
        showAnswers: false,
        score: 0,
        isComplete: false,
        mode: 'practice',
        checked: false,
        showModeSelector: true,
      });
    }
  }, [visible, quiz]);

  if (!quiz) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={closeModal}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.modalSafeAreView, { backgroundColor }]}>
        <View style={[styles.modalContainer, { backgroundColor }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <View style={styles.modalTitleContainer}>
              <Text style={[styles.modalTitle, { color: textColor }]}>
                {practiceState.isComplete ? 'Quiz Complete!' : 
                 practiceState.showModeSelector ? 'Choose Mode' :
                 practiceState.mode === 'preview' ? 'Preview Quiz' : 'Practice Quiz'}
              </Text>
              <TouchableOpacity 
                onPress={closeModal}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.selectedNoteTitle, { color: iconColor }]}>
              {quiz?.title || 'Untitled Quiz'}
            </Text>
            {!practiceState.showModeSelector && !practiceState.isComplete && (
              <View style={styles.modeIndicator}>
                <View style={styles.modeBadge}>
                  <Ionicons 
                    name={practiceState.mode === 'preview' ? 'eye' : 
                          practiceState.mode === 'practice' ? 'help-circle' : 'school'} 
                    size={16} 
                    color={practiceState.mode === 'preview' ? '#6366f1' : 
                           practiceState.mode === 'practice' ? '#10b981' : '#f093fb'} 
                  />
                  <Text style={[styles.modeText, { 
                    color: practiceState.mode === 'preview' ? '#6366f1' : 
                           practiceState.mode === 'practice' ? '#10b981' : '#f093fb'
                  }]}>
                    {practiceState.mode === 'preview' ? 'Preview' : 
                     practiceState.mode === 'practice' ? 'Practice' : 'Exam'} Mode
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={goBackToModeSelector}
                  style={styles.backToModeButton}
                >
                  <Ionicons name="settings-outline" size={16} color={iconColor} />
                  <Text style={[styles.backToModeText, { color: iconColor }]}>Change Mode</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Modal Content with ScrollView */}
          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalContentContainer}
          >
            {practiceState.showModeSelector ? (
              // Mode Selection Screen
              <View style={styles.modeSelectorContainer}>
                <View style={styles.modeSelectorHeader}>
                  <Text style={[styles.modeSelectorTitle, { color: textColor }]}>
                    Choose Your Quiz Mode
                  </Text>
                  <Text style={[styles.modeSelectorSubtitle, { color: iconColor }]}>
                    {practiceState.questions.length} questions available
                  </Text>
                </View>
                
                <View style={styles.modeOptions}>
                  <TouchableOpacity
                    style={[styles.modeOption, { backgroundColor: softerBackground, borderColor: '#6366f1' }]}
                    onPress={() => selectMode('preview')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.modeIcon, { backgroundColor: '#6366f1' }]}>
                      <Ionicons name="eye-outline" size={24} color="white" />
                    </View>
                    <View style={styles.modeContent}>
                      <Text style={[styles.modeOptionTitle, { color: textColor }]}>Preview Mode</Text>
                      
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={iconColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeOption, { backgroundColor: softerBackground, borderColor: '#10b981' }]}
                    onPress={() => selectMode('practice')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.modeIcon, { backgroundColor: '#10b981' }]}>
                      <Ionicons name="help-circle-outline" size={24} color="white" />
                    </View>
                    <View style={styles.modeContent}>
                      <Text style={[styles.modeOptionTitle, { color: textColor }]}>Practice Mode</Text>
                      
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={iconColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modeOption, { backgroundColor: softerBackground, borderColor: '#f093fb' }]}
                    onPress={() => selectMode('exam')}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.modeIcon, { backgroundColor: '#f093fb' }]}>
                      <Ionicons name="school-outline" size={24} color="white" />
                    </View>
                    <View style={styles.modeContent}>
                      <Text style={[styles.modeOptionTitle, { color: textColor }]}>Exam Mode</Text>
                      
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={iconColor} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : practiceState.isComplete ? (
              reviewMode ? (
                // Review Screen
                <View style={styles.reviewContainer}>
                  <Text style={[styles.reviewTitle, { color: textColor }]}>Review Answers</Text>
                  {practiceState.questions.map((q, i) => {
                    const userAnswer = practiceState.userAnswers[i];
                    const isCorrect = userAnswer === q.correctAnswer;
                    return (
                      <View key={i} style={[
                        styles.reviewQuestion,
                        { backgroundColor: '#f8f9fa', borderColor: isCorrect ? '#10b981' : '#ef4444' }
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
                </View>
              ) : (
                // Results Screen
                <View style={styles.resultsContainer}>
                  <View style={styles.resultsHeader}>
                    <Ionicons 
                      name={practiceState.mode === 'preview' ? "eye" : 
                            practiceState.mode === 'exam' ? "school" :
                            practiceState.score === practiceState.questions.length ? "trophy" : "star"} 
                      size={80} 
                      color={practiceState.mode === 'preview' ? "#6366f1" :
                             practiceState.mode === 'exam' ? "#f093fb" :
                             practiceState.score === practiceState.questions.length ? "#fbbf24" : "#10b981"} 
                    />
                    <Text style={[styles.resultsTitle, { color: textColor }]}>
                      {practiceState.mode === 'preview' ? "Preview Complete!" :
                       practiceState.mode === 'exam' ? "Exam Complete!" :
                       practiceState.score === practiceState.questions.length ? "Perfect Score!" : "Great Job!"}
                    </Text>
                    {practiceState.mode !== 'preview' && (
                      <>
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
                      </>
                    )}
                    {practiceState.mode === 'preview' && (
                      <Text style={[styles.resultsScore, { color: iconColor }]}>
                        You've reviewed all {practiceState.questions.length} questions
                      </Text>
                    )}
                    {/* Time taken */}
                    {practiceStartTime && practiceEndTime && (
                      <Text style={[styles.resultsPercentage, { color: iconColor }]}>
                        Time: {Math.round((practiceEndTime - practiceStartTime)/1000)}s
                      </Text>
                    )}
                  </View>
                  <View style={styles.resultsActions}>
                    <TouchableOpacity
                      style={[styles.restartButton, 
                        practiceState.mode === 'preview' ? { backgroundColor: '#6366f1' } : 
                        practiceState.mode === 'exam' ? { backgroundColor: '#f093fb' } :
                        { backgroundColor: '#10b981' }
                      ]}
                      onPress={restartPractice}
                    >
                      <Ionicons name="refresh-outline" size={20} color="white" />
                      <Text style={styles.restartButtonText}>
                        {practiceState.mode === 'preview' ? 'Preview Again' : 
                         practiceState.mode === 'exam' ? 'Retake Exam' : 'Try Again'}
                      </Text>
                    </TouchableOpacity>
                    
                    {practiceState.mode === 'practice' && (
                      <TouchableOpacity
                        style={[styles.restartButton, {backgroundColor: '#6366f1', marginTop: 12}]}
                        onPress={() => setReviewMode(true)}
                      >
                        <Ionicons name="eye-outline" size={20} color="white" />
                        <Text style={styles.restartButtonText}>Review Answers</Text>
                      </TouchableOpacity>
                    )}
                    
                    {practiceState.mode === 'practice' && (
                      <TouchableOpacity
                        style={[styles.restartButton, {backgroundColor: '#ef4444', marginTop: 12}]}
                        onPress={retakeIncorrectOnly}
                        disabled={practiceState.questions.filter((q, i) => practiceState.userAnswers[i] !== q.correctAnswer).length === 0}
                      >
                        <Ionicons name="repeat-outline" size={20} color="white" />
                        <Text style={styles.restartButtonText}>Retake Incorrect Only</Text>
                      </TouchableOpacity>
                    )}
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
                  <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#333333' : '#e5e7eb' }]}>
                    <View 
                      style={[
                        styles.progressBar, 
                        { 
                          width: `${((practiceState.currentQuestionIndex + 1) / practiceState.questions.length) * 100}%` 
                        }
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
                    let optionStyle = [styles.optionButton, { 
                      borderColor: borderColor, 
                      backgroundColor: cardBackground 
                    }];
                    if (isSelected && showCorrect) {
                      optionStyle = isCorrect ? 
                        [styles.optionButtonCorrect, { 
                          borderColor: '#10b981', 
                          backgroundColor: isDark ? '#1a3a1a' : '#f0fdf4' 
                        }] : 
                        [styles.optionButtonIncorrect, { 
                          borderColor: '#ef4444', 
                          backgroundColor: isDark ? '#3a1a1a' : '#fef2f2' 
                        }];
                    } else if (showCorrect && isCorrect) {
                      optionStyle = [styles.optionButtonCorrect, { 
                        borderColor: '#10b981', 
                        backgroundColor: isDark ? '#1a3a1a' : '#f0fdf4' 
                      }];
                    } else if (isSelected) {
                      optionStyle = [styles.optionButtonSelected, { 
                        borderColor: '#f093fb', 
                        backgroundColor: isDark ? '#2a1a3a' : '#faf5ff' 
                      }];
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
                  {/* Show Answer button (only for practice mode, not exam or preview) */}
                  {!practiceState.showAnswers && practiceState.mode === 'practice' && (
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
                  
                  {/* Navigation Buttons */}
                  <View style={styles.navigationButtons}>
                    <TouchableOpacity
                      style={[
                        styles.navButton,
                        { backgroundColor: softBackground },
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
                        { backgroundColor: softBackground },
                        // In preview mode, always allow navigation
                        // In exam mode, require answer selection
                        practiceState.mode === 'preview' ? {} : 
                        practiceState.mode === 'exam' && practiceState.userAnswers[practiceState.currentQuestionIndex] === -1 ? styles.navButtonDisabled : {}
                      ]}
                      onPress={nextQuestion}
                      disabled={practiceState.mode === 'exam' && practiceState.userAnswers[practiceState.currentQuestionIndex] === -1}
                    >
                      <Text style={[styles.navButtonText, { color: '#6b7280' }]}>
                        {practiceState.currentQuestionIndex === practiceState.questions.length - 1 ? 'Finish' : 'Next'}
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                  
                  {/* Mode indicators */}
                  {practiceState.mode === 'preview' && (
                    <View style={styles.previewIndicator}>
                      <Ionicons name="eye-outline" size={16} color="#6366f1" />
                      <Text style={[styles.previewText, { color: '#6366f1' }]}>
                        Preview Mode - All answers visible
                      </Text>
                    </View>
                  )}
                  
                  {practiceState.mode === 'exam' && (
                    <View style={styles.examIndicator}>
                      <Ionicons name="school-outline" size={16} color="#f093fb" />
                      <Text style={[styles.examText, { color: '#f093fb' }]}>
                        Exam Mode - No hints available
                      </Text>
                    </View>
                  )}
                  
                  {practiceState.mode === 'practice' && (
                    <View style={styles.practiceIndicator}>
                      <Ionicons name="help-circle-outline" size={16} color="#10b981" />
                      <Text style={[styles.practiceText, { color: '#10b981' }]}>
                        Practice Mode - Hints and feedback available
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalSafeAreView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
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
    padding: 20,
    paddingBottom: 0,
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
    padding: 20,
    paddingBottom: 0,
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
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  backToModeButton: {
    padding: 4,
  },
  backToModeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeSelectorContainer: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
  },
  modeSelectorHeader: {
    marginBottom: 24,
  },
  modeSelectorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modeSelectorSubtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  modeOptions: {
    marginTop: 24,
    gap: 16,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 20,
    borderWidth: 2,
    borderRadius: 16,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modeContent: {
    flex: 1,
    marginRight: 12,
  },
  modeOptionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modeOptionDescription: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 8,
  },
  modeFeatures: {
    marginTop: 8,
  },
  modeFeature: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  previewIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  previewText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  examIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  examText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  practiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  practiceText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    flexGrow: 1,
    paddingBottom: 0,
  },
  reviewContainer: {
    flex: 1,
    padding: 20,
    paddingBottom: 0,
  },
}); 