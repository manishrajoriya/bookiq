import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import ImageScanModal from '../components/ImageScanModal';
import ManualQuizModal from '../components/ManualQuizModal';
import NoteReaderModal from '../components/NoteReaderModal';
import PracticeQuizModal from '../components/PracticeQuizModal';
import QuizGenerationModal from '../components/QuizGenerationModal';
import ScanQuizModal from '../components/ScanQuizModal';
import { useThemeContext } from '../providers/ThemeProvider';
import { processImage } from '../services/geminiServices';
import { getAllQuizzes } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

const { width, height } = Dimensions.get('window');

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
  primary: '#f093fb',
  secondary: '#f093fb',
  accentColor: '#f093fb',
  dangerColor: '#ff6b6b',
  successColor: '#43e97b',
  backgroundColor: isDark ? '#0f0f0f' : '#f8f9fa',
  cardColor: isDark ? '#1a1a1a' : '#ffffff',
  headerBackground: isDark ? '#1a1a1a' : '#ffffff',
  borderColor: isDark ? '#333333' : '#f0f0f0',
  iconColor: isDark ? '#9BA1A6' : '#888',
  textColor: {
    primary: isDark ? '#ffffff' : '#1a1a1a',
    secondary: isDark ? '#cccccc' : '#666',
    light: isDark ? '#999999' : '#aaa',
    white: '#ffffff',
  },
});

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
  
  // Image scan modal state
  const [scanModalVisible, setScanModalVisible] = useState(false);
  
  // Error handling
  const [error, setError] = useState<ErrorState>({
    type: null,
    message: '',
    retryable: false
  });

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // Theme context
  const { resolvedTheme } = useThemeContext();
  const COLORS = getColors(resolvedTheme === 'dark');
  
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
      setQuizzes(quizzesData);
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

  const openScanModal = () => {
    setScanModalVisible(true);
  };

  const closeScanModal = () => {
    setScanModalVisible(false);
  };

  const processScannedImage = async (uri: string): Promise<string> => {
    try {
      const creditResult = await subscriptionService.spendCredits(1);
      if (!creditResult.success) {
        Alert.alert(
          "Out of Credits",
          creditResult.error || "You need at least 1 credit to scan an image.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => router.push('/paywall') }
          ]
        );
        throw new Error('Insufficient credits');
      }

      const text = await processImage(uri);
      if (!text || text.trim().length === 0) {
        throw new Error('No text could be detected in the image. Please try with a clearer image.');
      }

      return text.trim();
    } catch (error) {
      console.error('Image processing error:', error);
      throw new Error('Failed to process the image. Please try again with a clearer image.');
    }
  };

  const handleImageProcessed = (extractedText: string) => {
    closeScanModal();
    // Open quiz generation modal with scanned content
    setSelectedQuiz({
      id: 0,
      title: 'Scanned Document',
      content: extractedText,
      quiz_type: 'multiple-choice',
      createdAt: new Date().toISOString()
    });
    setQuizGenerationModalVisible(true);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getQuestionCount = (content: string) => {
    const matches = content.match(/^\d+\./gm);
    return matches ? matches.length : 0;
  };

  const renderQuizItem = ({ item, index }: { item: Quiz; index: number }) => {
    const questionCount = getQuestionCount(item.content || '');
    const hasAnswers = (item.content || '').includes('ANSWERS:');
    
    return (
      <View
        style={[
          styles.quizCard,
          { 
            backgroundColor: COLORS.cardColor, 
            borderColor: COLORS.borderColor,
          }
        ]}
      >
        {/* Main Content Area */}
        <TouchableOpacity 
          onPress={() => openNotePreview(item)}
          activeOpacity={0.8}
          style={styles.quizContent}
        >
          {/* Header with Title and Date */}
          <View style={styles.quizHeader}>
            <View style={styles.quizTitleContainer}>
              <Text style={[styles.quizTitle, { color: COLORS.textColor.primary }]} numberOfLines={2}>
                {item.title || 'Untitled Quiz'}
              </Text>
              {hasAnswers && (
                <View style={[styles.answersBadge, { backgroundColor: COLORS.successColor }]}>
                  <Ionicons name="checkmark-circle" size={12} color={COLORS.textColor.white} />
                  <Text style={[styles.badgeText, { color: COLORS.textColor.white }]}>Answers</Text>
                </View>
              )}
            </View>
            <Text style={[styles.quizDate, { color: COLORS.textColor.light }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
          
          {/* Content Preview */}
          <Text 
            numberOfLines={3} 
            style={[styles.quizContentText, { color: COLORS.textColor.secondary }]}
          >
            {(item.content || '').length > 100 ? (item.content || '').substring(0, 100) + '...' : (item.content || 'No content')}
          </Text>
          
          {/* Stats Footer */}
          <View style={styles.quizFooter}>
            <View style={styles.quizStats}>
              <View style={[styles.statItem, { backgroundColor: COLORS.backgroundColor }]}>
                <Ionicons name="help-circle" size={14} color={COLORS.accentColor} />
                <Text style={[styles.statText, { color: COLORS.textColor.secondary }]}>
                  {questionCount} questions
                </Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: COLORS.backgroundColor }]}>
                <Ionicons name="document-text" size={14} color={COLORS.accentColor} />
                <Text style={[styles.statText, { color: COLORS.textColor.secondary }]}>
                  {(item.quiz_type || 'multiple-choice').replace('-', ' ')}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Action Buttons */}
        <View style={styles.quizActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.successColor }]}
            onPress={() => startPractice(item)}
          >
            <Ionicons name="play" size={20} color={COLORS.textColor.white} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
            onPress={() => openQuizModal(item)}
          >
            <Ionicons name="help-circle" size={20} color={COLORS.accentColor} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Animated.View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: COLORS.backgroundColor, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Ionicons name="help-circle" size={80} color={COLORS.accentColor} />
      </Animated.View>
      <Text style={[styles.emptyTitle, { color: COLORS.textColor.primary }]}>No Saved Quizzes</Text>
      <Text style={[styles.emptySubtitle, { color: COLORS.textColor.secondary }]}>
        Generate quizzes from your notes, scan documents, or create them manually
      </Text>
      <View style={styles.emptyButtons}>
        <TouchableOpacity 
          style={[styles.emptyButton, { backgroundColor: COLORS.accentColor }]}
          onPress={openManualQuizModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color={COLORS.textColor.white} />
          <Text style={[styles.emptyButtonText, { color: COLORS.textColor.white }]}>Create Quiz</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.emptyButton, { backgroundColor: COLORS.accentColor }]}
          onPress={openScanQuizModal}
          activeOpacity={0.8}
        >
          <Ionicons name="scan" size={20} color={COLORS.textColor.white} />
          <Text style={[styles.emptyButtonText, { color: COLORS.textColor.white }]}>Scan Document</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderError = () => {
    if (!error.type) return null;
    
    return (
      <View style={[styles.errorBanner, { backgroundColor: COLORS.backgroundColor, borderBottomColor: COLORS.borderColor }]}>
        <View style={styles.errorContent}>
          <Ionicons 
            name="alert-circle" 
            size={20} 
            color={COLORS.dangerColor} 
          />
          <Text style={[styles.errorMessage, { color: COLORS.dangerColor }]}>{error.message}</Text>
        </View>
        {error.retryable && (
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: COLORS.dangerColor }]}
            onPress={retryLastAction}
          >
            <Text style={[styles.retryButtonText, { color: COLORS.textColor.white }]}>Retry</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.dismissButton}
          onPress={clearError}
        >
          <Ionicons name="close" size={16} color={COLORS.dangerColor} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.backgroundColor }]}>
      <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={COLORS.headerBackground} />
      
      {/* Header */}
      <Animated.View style={[
        styles.header, 
        { 
          backgroundColor: COLORS.headerBackground, 
          borderBottomColor: COLORS.borderColor,
          shadowOpacity: scrollY.interpolate({
            inputRange: [0, 10],
            outputRange: [0, 0.1],
            extrapolate: 'clamp'
          }),
          elevation: scrollY.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 2],
            extrapolate: 'clamp'
          })
        }
      ]}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: COLORS.textColor.primary }]}>Quiz Maker</Text>
            <Text style={[styles.headerSubtitle, { color: COLORS.textColor.secondary }]}>
              {quizzes.length} saved {quizzes.length === 1 ? 'quiz' : 'quizzes'}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: COLORS.backgroundColor }]}
              onPress={openManualQuizModal}
            >
              <Ionicons name="add" size={24} color={COLORS.accentColor} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: COLORS.backgroundColor }]}
              onPress={openScanModal}
            >
              <Ionicons name="scan" size={24} color={COLORS.accentColor} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Error Banner */}
      {renderError()}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentColor} />
          <Text style={[styles.loadingText, { color: COLORS.accentColor }]}>Loading your quizzes...</Text>
        </View>
      ) : quizzes.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.FlatList
          data={quizzes}
          keyExtractor={(item) => `quiz-${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderQuizItem}
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
          style={[styles.fab, { backgroundColor: COLORS.accentColor }]} 
          onPress={openScanModal}
          activeOpacity={0.9}
        >
          <Ionicons name="scan" size={24} color={COLORS.textColor.white} />
        </TouchableOpacity>
      </Animated.View>

      {/* Modals */}
      <NoteReaderModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        note={selectedQuiz}
        isScanNote={false}
        isQuiz={true}
      />

      <ImageScanModal
        visible={scanModalVisible}
        onClose={closeScanModal}
        onImageProcessed={handleImageProcessed}
        title="Scan for Quiz"
        subtitle="Take a photo or choose from gallery to extract text for quiz generation"
        actionButtonText="Generate Quiz"
        actionButtonIcon="help-circle-outline"
        accentColor={COLORS.accentColor}
        onProcessImage={processScannedImage}
        showExtractedText={true}
        showActionButton={true}
      />

      <QuizGenerationModal
        visible={quizGenerationModalVisible}
        onClose={closeQuizModal}
        sourceContent={selectedQuiz?.content || ''}
        sourceTitle={selectedQuiz?.title || ''}
        sourceId={selectedQuiz?.id}
        sourceType={(selectedQuiz?.source_note_type as 'note' | 'scan-note') || 'note'}
        onQuizSaved={handleQuizSaved}
      />

      <ManualQuizModal
        visible={manualQuizModalVisible}
        onClose={() => setManualQuizModalVisible(false)}
        onQuizSaved={handleQuizSaved}
      />

      <ScanQuizModal
        visible={scanQuizModalVisible}
        onClose={() => setScanQuizModalVisible(false)}
        onQuizSaved={handleQuizSaved}
      />

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
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
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
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  emptyButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  quizCard: {
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  quizContent: {
    padding: 20,
    paddingBottom: 16,
  },
  quizHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  quizTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  quizTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    lineHeight: 24,
  },
  answersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  quizDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  quizContentText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    marginTop: 8,
  },
  quizFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quizStats: {
    flexDirection: 'row',
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
  },
  quizActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorMessage: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryButtonText: {
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
    borderRadius: 50,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default QuizMaker;
