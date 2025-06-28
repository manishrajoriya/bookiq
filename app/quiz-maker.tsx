import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import ManualQuizModal from '../components/ManualQuizModal';
import NoteReaderModal from '../components/NoteReaderModal';
import PracticeQuizModal from '../components/PracticeQuizModal';
import QuizGenerationModal from '../components/QuizGenerationModal';
import ScanQuizModal from '../components/ScanQuizModal';
import { useThemeColor } from '../hooks/useThemeColor';
import { getAllQuizzes } from '../services/historyStorage';

const { width, height } = Dimensions.get('window');

// Enhanced interfaces
interface Quiz {
  id: number;
  title: string;
  content: string;
  quiz_type: string;
  source_note_id?: number;
  source_note_type?: string;
  createdAt: string;
}

interface ErrorState {
  type: 'generating' | 'credits' | 'network' | 'scanning' | null;
  message: string;
  retryable: boolean;
}

interface PracticeQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  questionType: 'multiple-choice' | 'true-false';
}

const QuizMaker = () => {
  const router = useRouter();
  
  // State management
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  
  // Shared Quiz Generation Modal state
  const [quizGenerationModalVisible, setQuizGenerationModalVisible] = useState(false);
  
  // Separate component modals
  const [manualQuizModalVisible, setManualQuizModalVisible] = useState(false);
  const [scanQuizModalVisible, setScanQuizModalVisible] = useState(false);
  const [practiceModalVisible, setPracticeModalVisible] = useState(false);
  
  // Error handling
  const [error, setError] = useState<ErrorState>({
    type: null,
    message: '',
    retryable: false
  });

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Enhanced error handling
  const handleError = (type: ErrorState['type'], message: string, retryable: boolean = true) => {
    setError({ type, message, retryable });
    if (Platform.OS !== 'web') {
      Vibration.vibrate(100);
    }
  };

  const clearError = () => {
    setError({ type: null, message: '', retryable: false });
  };

  const loadQuizzes = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      
      const quizzesData = await getAllQuizzes();
      
      const enhancedQuizzes = quizzesData.map(quiz => ({
        ...quiz,
        createdAt: new Date(quiz.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
      
      setQuizzes(enhancedQuizzes);
    } catch (error) {
      console.error('Failed to load quizzes:', error);
      handleError('network', 'Failed to load quizzes. Please check your connection and try again.', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadQuizzes();
    }, [loadQuizzes])
  );

  const openManualQuizModal = () => {
    setManualQuizModalVisible(true);
  };

  const openScanQuizModal = () => {
    setScanQuizModalVisible(true);
  };

  const openNotePreview = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setPreviewModalVisible(true);
  };

  const openQuizModal = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setQuizGenerationModalVisible(true);
    clearError();
  };

  const closeQuizModal = () => {
    setQuizGenerationModalVisible(false);
    setSelectedQuiz(null);
    clearError();
  };

  const handleQuizSaved = () => {
    loadQuizzes();
  };

  const retryLastAction = () => {
    loadQuizzes();
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

  const startPractice = (quiz: Quiz, questionsOverride?: PracticeQuestion[]) => {
    const questions = questionsOverride || parseQuizContent(quiz.content);
    setSelectedQuiz(quiz);
    setPracticeModalVisible(true);
  };

  const closePracticeModal = () => {
    setPracticeModalVisible(false);
    setSelectedQuiz(null);
  };

  // Get theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const cardColor = useThemeColor({}, 'background');
  const iconColor = useThemeColor({}, 'icon');

  const renderNoteItem = ({ item, index }: { item: Quiz; index: number }) => (
    <View style={[styles.noteCardContainer, { backgroundColor: cardColor, borderColor }]}>
      <TouchableOpacity 
        onPress={() => openNotePreview(item)}
        activeOpacity={0.8}
        style={styles.noteCard}
      >
        <View style={styles.noteCardContent}>
          <View style={styles.noteHeader}>
            <Text style={[styles.noteTitle, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
              {item.title}
            </Text>
            <View style={styles.noteMetadata}>
              <Text style={[styles.wordCount, { color: iconColor }]}>{item.quiz_type.replace('-', ' ')}</Text>
            </View>
          </View>
          
          <Text 
            numberOfLines={3} 
            style={[styles.noteContent, { color: textColor }]}
            ellipsizeMode="tail"
          >
            {item.content}
          </Text>
          
          <View style={styles.noteFooter}>
            <Text style={[styles.noteDate, { color: iconColor }]}>
              {item.createdAt}
            </Text>
            <View style={styles.noteActions}>
              <TouchableOpacity 
                style={styles.practiceButton}
                onPress={() => startPractice(item)}
              >
                <Ionicons name="play-outline" size={16} color={iconColor} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quizButton}
                onPress={() => openQuizModal(item)}
              >
                <Ionicons name="help-circle-outline" size={16} color={iconColor} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Animated.View
        style={[
          styles.emptyIconContainer,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Ionicons name="help-circle-outline" size={80} color="#f0f0ff" />
      </Animated.View>
      <Text style={styles.emptyTitle}>No Saved Quizzes</Text>
      <Text style={styles.emptySubtitle}>
        Generate quizzes from your notes, scan documents, or create them manually
      </Text>
      <View style={styles.emptyButtons}>
        <TouchableOpacity 
          style={styles.manualQuizEmptyButton}
          onPress={openManualQuizModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add-outline" size={20} color="#fff" />
          <Text style={styles.manualQuizEmptyButtonText}>Create Quiz</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.scanEmptyButton}
          onPress={openScanQuizModal}
          activeOpacity={0.8}
        >
          <Ionicons name="scan-outline" size={20} color="#fff" />
          <Text style={styles.scanEmptyButtonText}>Scan Document</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.emptyNote}>
        💡 If you're experiencing database issues, try the red reset button in the header
      </Text>
    </View>
  );

  const renderError = () => {
    if (!error.type) return null;
    
    return (
      <View style={styles.errorBanner}>
        <View style={styles.errorContent}>
          <Ionicons 
            name="alert-circle-outline" 
            size={20} 
            color="#ef4444" 
          />
          <Text style={[styles.errorMessage, { color: textColor }]}>{error.message}</Text>
        </View>
        {error.retryable && (
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={retryLastAction}
          >
            <Text style={[styles.retryButtonText, { color: textColor }]}>Retry</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.dismissButton}
          onPress={clearError}
        >
          <Ionicons name="close" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle={backgroundColor === '#fff' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
      
      {/* Header with animated shadow */}
      <Animated.View style={[styles.header, { backgroundColor, borderBottomColor: borderColor, shadowColor: iconColor }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: textColor }]}>Quiz Maker</Text>
            <Text style={[styles.headerSubtitle, { color: iconColor }]}>
              {quizzes.length} saved {quizzes.length === 1 ? 'quiz' : 'quizzes'}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.manualQuizButton}
              onPress={openManualQuizModal}
            >
              <Ionicons name="add-outline" size={24} color={iconColor} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={openScanQuizModal}
            >
              <Ionicons name="scan-outline" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Error Banner */}
      {renderError()}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f093fb" />
          <Text style={styles.loadingText}>Loading your quizzes...</Text>
        </View>
      ) : quizzes.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.FlatList
          data={quizzes}
          keyExtractor={(item) => `quiz-${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderNoteItem}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => clearError()}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={<View style={{ height: 8 }} />}
          ListFooterComponent={<View style={{ height: 80 }} />}
        />
      )}

      {/* Floating Action Button - Only shown when scrolled */}
      <Animated.View style={[
        styles.fabContainer,
        {
          opacity: scrollY.interpolate({
            inputRange: [0, 50],
            outputRange: [0, 1],
            extrapolate: 'clamp'
          }),
          transform: [{
            translateY: scrollY.interpolate({
              inputRange: [0, 50],
              outputRange: [100, 0],
              extrapolate: 'clamp'
            })
          }]
        }
      ]}>
        <TouchableOpacity 
          style={styles.fab} 
          onPress={openScanQuizModal}
          activeOpacity={0.9}
        >
          <Ionicons name="scan-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Note Preview Modal */}
      <NoteReaderModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        note={selectedQuiz}
        isScanNote={false}
        isQuiz={true}
      />

      {/* Quiz Generation Modal */}
      <QuizGenerationModal
        visible={quizGenerationModalVisible}
        onClose={closeQuizModal}
        sourceContent={selectedQuiz?.content || ''}
        sourceTitle={selectedQuiz?.title || ''}
        sourceId={selectedQuiz?.id}
        sourceType={(selectedQuiz?.source_note_type as 'note' | 'scan-note') || 'note'}
        onQuizSaved={handleQuizSaved}
      />

      {/* Manual Quiz Creation Modal */}
      <ManualQuizModal
        visible={manualQuizModalVisible}
        onClose={() => setManualQuizModalVisible(false)}
        onQuizSaved={handleQuizSaved}
      />

      {/* Scan Quiz Modal */}
      <ScanQuizModal
        visible={scanQuizModalVisible}
        onClose={() => setScanQuizModalVisible(false)}
        onQuizSaved={handleQuizSaved}
      />

      {/* Practice Quiz Modal */}
      <PracticeQuizModal
        visible={practiceModalVisible}
        onClose={closePracticeModal}
        quiz={selectedQuiz}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 16,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualQuizButton: {
    padding: 4,
    marginLeft: 8,
  },
  scanButton: {
    padding: 4,
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#f093fb',
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    marginBottom: 24,
    backgroundColor: '#f0f0ff',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  emptyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  manualQuizEmptyButton: {
    backgroundColor: '#f093fb',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualQuizEmptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  scanEmptyButton: {
    backgroundColor: '#f093fb',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanEmptyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyNote: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  noteCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  noteCard: {
    flex: 1,
  },
  noteCardContent: {
    padding: 16,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  noteMetadata: {
    alignItems: 'flex-end',
  },
  wordCount: {
    fontSize: 12,
    color: '#f093fb',
    fontWeight: '600',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  noteContent: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4b5563',
    marginBottom: 16,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  practiceButton: {
    padding: 4,
    marginLeft: 8,
  },
  quizButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#fee2e2',
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#ef4444',
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    opacity: 0,
    transform: [{ translateY: 100 }],
  },
  fab: {
    backgroundColor: '#f093fb',
    borderRadius: 50,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default QuizMaker;
