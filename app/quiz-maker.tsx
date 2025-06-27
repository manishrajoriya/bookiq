import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import NoteReaderModal from '../components/NoteReaderModal';
import { generateQuizFromNotes, processImage } from '../services/geminiServices';
import { addHistory, addQuiz, getAllQuizzes, spendCredits } from '../services/historyStorage';

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

interface QuizState {
  isGenerating: boolean;
  progress: number;
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

interface PracticeState {
  questions: PracticeQuestion[];
  currentQuestionIndex: number;
  userAnswers: number[];
  showAnswers: boolean;
  score: number;
  isComplete: boolean;
  mode: 'per-question' | 'all-at-once';
  checked: boolean; // for all-at-once mode
}

type QuizType = 'multiple-choice' | 'true-false' | 'fill-blank';

interface QuizQuestion {
  id: string;
  question: string;
  questionType: 'multiple-choice' | 'true-false';
  options: string[];
  correctAnswer: number;
}

const QuizMaker = () => {
  const router = useRouter();
  // State management
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  
  // Quiz generation state
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<string>('');
  const [selectedQuizType, setSelectedQuizType] = useState<QuizType>('multiple-choice');
  const [quizState, setQuizState] = useState<QuizState>({
    isGenerating: false,
    progress: 0
  });
  
  // Scan state for direct quiz generation
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  
  // Manual quiz creation state
  const [manualQuizModalVisible, setManualQuizModalVisible] = useState(false);
  const [manualQuizTitle, setManualQuizTitle] = useState('');
  const [manualQuizQuestions, setManualQuizQuestions] = useState<QuizQuestion[]>([]);
  const [manualQuizType, setManualQuizType] = useState<QuizType>('multiple-choice');
  const [isSavingManualQuiz, setIsSavingManualQuiz] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Practice mode state
  const [practiceModalVisible, setPracticeModalVisible] = useState(false);
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

  const [practiceModeSelectVisible, setPracticeModeSelectVisible] = useState(false);

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

  // Scan handlers for direct quiz generation
  const openScanModal = () => {
    setScanModalVisible(true);
    setImageUri(null);
    setExtractedText('');
    clearError();
  };

  const closeScanModal = () => {
    if (isScanning) {
      Alert.alert(
        'Scan in Progress',
        'Please wait for the scan to complete.',
        [{ text: 'OK' }]
      );
      return;
    }
    setScanModalVisible(false);
    setImageUri(null);
    setExtractedText('');
    clearError();
  };

  const handleCameraScan = async () => {
    try {
      clearError();
      setIsScanning(true);

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please grant camera permission to scan documents.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.9,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        await processScannedImage(asset.uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      handleError('scanning', 'Failed to capture image. Please try again.', true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleGalleryScan = async () => {
    try {
      clearError();
      setIsScanning(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.9,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        await processScannedImage(asset.uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      handleError('scanning', 'Failed to select image from gallery. Please try again.', true);
    } finally {
      setIsScanning(false);
    }
  };

  const processScannedImage = async (uri: string) => {
    try {
      const hasEnoughCredits = await spendCredits(1);
      if (!hasEnoughCredits) {
        Alert.alert(
          "Out of Credits",
          "You need at least 1 credit to scan an image.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => router.push('/paywall') }
          ]
        );
        return;
      }

      const text = await processImage(uri);
      if (!text || text.trim().length === 0) {
        handleError('scanning', 'No text could be detected in the image. Please try with a clearer image.', true);
        return;
      }

      setExtractedText(text.trim());
      clearError();
    } catch (error) {
      console.error('Image processing error:', error);
      handleError('scanning', 'Failed to process the image. Please try again with a clearer image.', true);
    }
  };

  const generateQuiz = async () => {
    if (!selectedQuiz) return;

    try {
      setQuizState(prev => ({ ...prev, isGenerating: true }));
      clearError();

      const hasEnoughCredits = await spendCredits(2);
      if (!hasEnoughCredits) {
        Alert.alert(
          "Out of Credits",
          "You need at least 2 credits to generate a quiz.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => router.push('/paywall') }
          ]
        );
        return;
      }

      setQuizState(prev => ({ ...prev, progress: 30 }));

      const quiz = await generateQuizFromNotes(
        selectedQuiz.content,
        selectedQuizType
      );

      setQuizState(prev => ({ ...prev, progress: 80 }));

      setGeneratedQuiz(quiz);
      setQuizState(prev => ({ ...prev, progress: 100 }));

      // Add to history
      await addHistory('', 'quiz-maker', selectedQuiz.title, quiz);

    } catch (error) {
      console.error('Quiz generation error:', error);
      handleError('generating', 'Failed to generate quiz. Please try again.', true);
    } finally {
      setQuizState(prev => ({ ...prev, isGenerating: false, progress: 0 }));
    }
  };

  const saveGeneratedQuiz = async () => {
    if (!generatedQuiz || !selectedQuiz) return;

    try {
      const quizTitle = `${selectedQuiz.title} - ${selectedQuizType.replace('-', ' ')} Quiz`;
      
      await addQuiz(
        quizTitle,
        generatedQuiz,
        selectedQuizType,
        0, // We'll calculate the actual number when parsing
        selectedQuiz.id,
        selectedQuiz.source_note_type as 'note' | 'scan-note'
      );

      // Refresh the quiz list
      await loadQuizzes();
      
      Alert.alert(
        'Success!', 
        'Quiz has been saved successfully.',
        [{ text: 'OK' }]
      );
      
      closeQuizModal();
    } catch (error) {
      console.error('Failed to save quiz:', error);
      Alert.alert('Error', 'Failed to save quiz. Please try again.');
    }
  };

  const generateQuizFromScan = async () => {
    if (!extractedText) return;

    try {
      setQuizState(prev => ({ ...prev, isGenerating: true }));
      clearError();

      const hasEnoughCredits = await spendCredits(2);
      if (!hasEnoughCredits) {
        Alert.alert(
          "Out of Credits",
          "You need at least 2 credits to generate a quiz.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => router.push('/paywall') }
          ]
        );
        return;
      }

      setQuizState(prev => ({ ...prev, progress: 30 }));

      const quiz = await generateQuizFromNotes(
        extractedText,
        selectedQuizType
      );

      setQuizState(prev => ({ ...prev, progress: 80 }));

      setGeneratedQuiz(quiz);
      setQuizState(prev => ({ ...prev, progress: 100 }));

      // Add to history
      await addHistory(imageUri || '', 'quiz-maker', 'Scanned Document', quiz);

    } catch (error) {
      console.error('Quiz generation error:', error);
      handleError('generating', 'Failed to generate quiz. Please try again.', true);
    } finally {
      setQuizState(prev => ({ ...prev, isGenerating: false, progress: 0 }));
    }
  };

  const saveScannedQuiz = async () => {
    if (!generatedQuiz) return;

    try {
      const quizTitle = `Scanned Document - ${selectedQuizType.replace('-', ' ')} Quiz`;
      
      await addQuiz(
        quizTitle,
        generatedQuiz,
        selectedQuizType,
        0 // We'll calculate the actual number when parsing
      );

      // Refresh the quiz list
      await loadQuizzes();
      
      Alert.alert(
        'Success!', 
        'Quiz has been saved successfully.',
        [{ text: 'OK' }]
      );
      
      closeScanModal();
    } catch (error) {
      console.error('Failed to save quiz:', error);
      Alert.alert('Error', 'Failed to save quiz. Please try again.');
    }
  };

  const openManualQuizModal = () => {
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
    setManualQuizModalVisible(true);
  };

  const closeManualQuizModal = () => {
    if (isSavingManualQuiz) {
      Alert.alert(
        'Saving in Progress',
        'Please wait for the quiz to be saved.',
        [{ text: 'OK' }]
      );
      return;
    }
    setManualQuizModalVisible(false);
    setManualQuizTitle('');
    setManualQuizQuestions([]);
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

      // Refresh the quiz list
      await loadQuizzes();
      
      Alert.alert(
        'Success!', 
        'Quiz has been saved successfully.',
        [{ text: 'OK' }]
      );
      
      closeManualQuizModal();
    } catch (error) {
      console.error('Failed to save manual quiz:', error);
      Alert.alert('Error', 'Failed to save quiz. Please try again.');
    } finally {
      setIsSavingManualQuiz(false);
    }
  };

  const openNotePreview = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setPreviewModalVisible(true);
  };

  const openQuizModal = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setQuizModalVisible(true);
    setGeneratedQuiz('');
    clearError();
  };

  const closeQuizModal = () => {
    if (quizState.isGenerating) {
      Alert.alert(
        'Generation in Progress',
        'Please wait for the quiz generation to complete.',
        [{ text: 'OK' }]
      );
      return;
    }
    setQuizModalVisible(false);
    setSelectedQuiz(null);
    setGeneratedQuiz('');
    clearError();
  };

  const retryLastAction = () => {
    switch (error.type) {
      case 'generating':
        if (selectedQuiz) {
          generateQuiz();
        } else if (extractedText) {
          generateQuizFromScan();
        }
        break;
      case 'scanning':
        if (imageUri) {
          processScannedImage(imageUri);
        }
        break;
      case 'network':
        loadQuizzes();
        break;
      default:
        clearError();
    }
  };

  const parseQuizContent = (content: string): PracticeQuestion[] => {
    const questions: PracticeQuestion[] = [];
    const lines = content.split('\n');
    let currentQuestion: PracticeQuestion | null = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
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

  const startPractice = (quiz: Quiz, mode: 'per-question' | 'all-at-once' = 'per-question') => {
    const questions = parseQuizContent(quiz.content);
    setPracticeState({
      questions,
      currentQuestionIndex: 0,
      userAnswers: new Array(questions.length).fill(-1),
      showAnswers: false,
      score: 0,
      isComplete: false,
      mode,
      checked: false,
    });
    setSelectedQuiz(quiz);
    setPracticeModalVisible(true);
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
      } else if (prev.mode === 'per-question') {
        // Calculate final score
        const score = prev.userAnswers.reduce((total, answer, index) => {
          return total + (answer === prev.questions[index].correctAnswer ? 1 : 0);
        }, 0);
        return {
          ...prev,
          isComplete: true,
          score
        };
      } else {
        // all-at-once mode: just finish questions, don't show answers yet
        return {
          ...prev,
          isComplete: true
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
    if (!selectedQuiz) return;
    startPractice(selectedQuiz);
  };

  const closePracticeModal = () => {
    setPracticeModalVisible(false);
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
    setSelectedQuiz(null);
  };

  const renderNoteItem = ({ item, index }: { item: Quiz; index: number }) => (
    <View style={styles.noteCardContainer}>
      <TouchableOpacity 
        onPress={() => openNotePreview(item)}
        activeOpacity={0.8}
        style={styles.noteCard}
      >
        <View style={styles.noteCardContent}>
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle} numberOfLines={1} ellipsizeMode="tail">
              {item.title}
            </Text>
            <View style={styles.noteMetadata}>
              <Text style={styles.wordCount}>{item.quiz_type.replace('-', ' ')}</Text>
            </View>
          </View>
          
          <Text 
            numberOfLines={3} 
            style={styles.noteContent}
            ellipsizeMode="tail"
          >
            {item.content}
          </Text>
          
          <View style={styles.noteFooter}>
            <Text style={styles.noteDate}>
              {item.createdAt}
            </Text>
            <View style={styles.noteActions}>
              <TouchableOpacity 
                style={styles.practiceButton}
                onPress={() => { setSelectedQuiz(item); setPracticeModeSelectVisible(true); }}
              >
                <Ionicons name="play-outline" size={16} color="#10b981" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quizButton}
                onPress={() => openQuizModal(item)}
              >
                <Ionicons name="help-circle-outline" size={16} color="#f093fb" />
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
          onPress={openScanModal}
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
          <Text style={styles.errorMessage}>{error.message}</Text>
        </View>
        {error.retryable && (
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={retryLastAction}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
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

  const renderQuizProgress = () => {
    if (!quizState.isGenerating) return null;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Ionicons name="help-circle-outline" size={24} color="#f093fb" />
          <Text style={styles.progressTitle}>Generating Quiz...</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar,
              { width: `${quizState.progress}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{quizState.progress}% complete</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header with animated shadow */}
      <Animated.View style={[
        styles.header,
        {
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
            <Text style={styles.headerTitle}>Quiz Maker</Text>
            <Text style={styles.headerSubtitle}>
              {quizzes.length} saved {quizzes.length === 1 ? 'quiz' : 'quizzes'}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.manualQuizButton}
              onPress={openManualQuizModal}
            >
              <Ionicons name="add-outline" size={24} color="#10b981" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={openScanModal}
            >
              <Ionicons name="scan-outline" size={24} color="#f093fb" />
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
          onPress={openScanModal}
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
      <Modal
        visible={quizModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeQuizModal}
      >
        <SafeAreaView style={styles.modalSafeAreView}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Generate Quiz</Text>
                <TouchableOpacity 
                  onPress={closeQuizModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {selectedQuiz && (
                <Text style={styles.selectedNoteTitle}>
                  From: {selectedQuiz.title}
                </Text>
              )}
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Quiz Settings */}
              {!generatedQuiz && (
                <View style={styles.settingsSection}>
                  <Text style={styles.sectionTitle}>Quiz Settings</Text>
                  
                  <View style={styles.settingGroup}>
                    <Text style={styles.settingLabel}>Quiz Type</Text>
                    <View style={styles.quizTypeButtons}>
                      {(['multiple-choice', 'true-false', 'fill-blank'] as QuizType[]).map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.quizTypeButton,
                            selectedQuizType === type && styles.quizTypeButtonActive
                          ]}
                          onPress={() => setSelectedQuizType(type)}
                        >
                          <Text style={[
                            styles.quizTypeButtonText,
                            selectedQuizType === type && styles.quizTypeButtonTextActive
                          ]}>
                            {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Number of Questions - Removed for automatic generation */}
                  {/* <View style={styles.settingGroup}>
                    <Text style={styles.settingLabel}>Number of Questions</Text>
                    <View style={styles.questionCountButtons}>
                      {[3, 5, 10, 15].map((count) => (
                        <TouchableOpacity
                          key={count}
                          style={[
                            styles.questionCountButton,
                            numberOfQuestions === count && styles.questionCountButtonActive
                          ]}
                          onPress={() => setNumberOfQuestions(count)}
                        >
                          <Text style={[
                            styles.questionCountButtonText,
                            numberOfQuestions === count && styles.questionCountButtonTextActive
                          ]}>
                            {count}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View> */}

                  <TouchableOpacity
                    style={[
                      styles.generateButton,
                      quizState.isGenerating && styles.generateButtonDisabled
                    ]}
                    onPress={generateQuiz}
                    disabled={quizState.isGenerating}
                  >
                    {quizState.isGenerating ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Ionicons name="sparkles-outline" size={20} color="white" />
                        <Text style={styles.generateButtonText}>
                          Generate Quiz (2 Credits)
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Progress Indicator */}
              {renderQuizProgress()}

              {/* Generated Quiz */}
              {generatedQuiz && (
                <View style={styles.quizSection}>
                  <Text style={styles.sectionTitle}>Generated Quiz</Text>
                  <View style={styles.quizContent}>
                    <Text style={styles.quizText}>{generatedQuiz}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveGeneratedQuiz}
                  >
                    <Ionicons name="save-outline" size={20} color="white" />
                    <Text style={styles.saveButtonText}>Save Quiz</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Scan Modal for Direct Quiz Generation */}
      <Modal
        visible={scanModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeScanModal}
      >
        <SafeAreaView style={styles.modalSafeAreView}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Scan for Quiz</Text>
                <TouchableOpacity 
                  onPress={closeScanModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Scan Buttons - Only show if no image selected */}
              {!imageUri && (
                <View style={styles.scanSection}>
                  <Text style={styles.sectionTitle}>Scan Document</Text>
                  <Text style={styles.sectionSubtitle}>
                    Take a photo or choose from gallery to extract text for quiz generation
                  </Text>
                  <View style={styles.scanButtons}>
                    <TouchableOpacity 
                      style={[
                        styles.scanButton,
                        isScanning && styles.scanButtonDisabled
                      ]}
                      onPress={handleCameraScan}
                      disabled={isScanning}
                    >
                      <View style={styles.scanButtonIcon}>
                        <Ionicons name="camera-outline" size={28} color="#f093fb" />
                      </View>
                      <Text style={styles.scanButtonText}>Camera</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.scanButton,
                        isScanning && styles.scanButtonDisabled
                      ]}
                      onPress={handleGalleryScan}
                      disabled={isScanning}
                    >
                      <View style={styles.scanButtonIcon}>
                        <Ionicons name="image-outline" size={28} color="#f093fb" />
                      </View>
                      <Text style={styles.scanButtonText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Image Preview */}
              {imageUri && (
                <View style={styles.imageSection}>
                  <Text style={styles.sectionTitle}>Document Preview</Text>
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => {
                        setImageUri(null);
                        setExtractedText('');
                        clearError();
                      }}
                    >
                      <Ionicons name="close" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Extracted Text */}
              {extractedText && (
                <View style={styles.extractedTextSection}>
                  <Text style={styles.sectionTitle}>Extracted Text</Text>
                  <View style={styles.extractedTextContainer}>
                    <Text style={styles.extractedTextContent}>{extractedText}</Text>
                  </View>
                </View>
              )}

              {/* Quiz Settings */}
              {extractedText && (
                <View style={styles.quizSettingsSection}>
                  <Text style={styles.sectionTitle}>Quiz Settings</Text>
                  
                  <View style={styles.settingGroup}>
                    <Text style={styles.settingLabel}>Quiz Type</Text>
                    <View style={styles.quizTypeButtons}>
                      {(['multiple-choice', 'true-false', 'fill-blank'] as QuizType[]).map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.quizTypeButton,
                            selectedQuizType === type && styles.quizTypeButtonActive
                          ]}
                          onPress={() => setSelectedQuizType(type)}
                        >
                          <Text style={[
                            styles.quizTypeButtonText,
                            selectedQuizType === type && styles.quizTypeButtonTextActive
                          ]}>
                            {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Number of Questions - Removed for automatic generation */}
                  {/* <View style={styles.settingGroup}>
                    <Text style={styles.settingLabel}>Number of Questions</Text>
                    <View style={styles.questionCountButtons}>
                      {[3, 5, 10, 15].map((count) => (
                        <TouchableOpacity
                          key={count}
                          style={[
                            styles.questionCountButton,
                            numberOfQuestions === count && styles.questionCountButtonActive
                          ]}
                          onPress={() => setNumberOfQuestions(count)}
                        >
                          <Text style={[
                            styles.questionCountButtonText,
                            numberOfQuestions === count && styles.questionCountButtonTextActive
                          ]}>
                            {count}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View> */}
                </View>
              )}

              {/* Generated Quiz from Scan */}
              {generatedQuiz && (
                <View style={styles.quizSection}>
                  <Text style={styles.sectionTitle}>Generated Quiz</Text>
                  <View style={styles.quizContent}>
                    <Text style={styles.quizText}>{generatedQuiz}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveScannedQuiz}
                  >
                    <Ionicons name="save-outline" size={20} color="white" />
                    <Text style={styles.saveButtonText}>Save Quiz</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Progress Indicator */}
              {renderQuizProgress()}
            </ScrollView>

            {/* Generate Quiz Button */}
            {extractedText && !generatedQuiz && (
              <View style={styles.generateButtonSection}>
                <TouchableOpacity
                  style={[
                    styles.generateButton,
                    quizState.isGenerating && styles.generateButtonDisabled
                  ]}
                  onPress={generateQuizFromScan}
                  disabled={quizState.isGenerating}
                >
                  {quizState.isGenerating ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={20} color="white" />
                      <Text style={styles.generateButtonText}>
                        Generate Quiz (2 Credits)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* Manual Quiz Creation Modal */}
      <Modal
        visible={manualQuizModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeManualQuizModal}
      >
        <SafeAreaView style={styles.modalSafeAreView}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Create Custom Quiz</Text>
                <TouchableOpacity 
                  onPress={closeManualQuizModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Quiz Title */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quiz Title</Text>
                <TextInput
                  style={styles.titleInput}
                  value={manualQuizTitle}
                  onChangeText={setManualQuizTitle}
                  placeholder="Enter quiz title..."
                  placeholderTextColor="#9ca3af"
                  returnKeyType="next"
                />
              </View>

              {/* Question Navigation */}
              <View style={styles.questionNavigation}>
                <Text style={styles.navigationTitle}>Questions ({manualQuizQuestions.length})</Text>
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
                        currentQuestionIndex === index && styles.questionTabActive
                      ]}
                      onPress={() => setCurrentQuestionIndex(index)}
                    >
                      <Text style={[
                        styles.questionTabText,
                        currentQuestionIndex === index && styles.questionTabTextActive
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
                <View style={styles.questionSection}>
                  <View style={styles.questionHeader}>
                    <Text style={styles.questionNumber}>Question {currentQuestionIndex + 1}</Text>
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
                    <Text style={styles.inputLabel}>Question Type</Text>
                    <View style={styles.questionTypeButtons}>
                      <TouchableOpacity
                        style={[
                          styles.questionTypeButton,
                          manualQuizQuestions[currentQuestionIndex].questionType === 'multiple-choice' && 
                          styles.questionTypeButtonActive
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
                          manualQuizQuestions[currentQuestionIndex].questionType === 'multiple-choice' && 
                          styles.questionTypeButtonTextActive
                        ]}>
                          Multiple Choice
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.questionTypeButton,
                          manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' && 
                          styles.questionTypeButtonActive
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
                          manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' && 
                          styles.questionTypeButtonTextActive
                        ]}>
                          True/False
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Question Text */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Question</Text>
                    <TextInput
                      style={styles.questionInput}
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
                    <Text style={styles.inputLabel}>Answer Options</Text>
                    <Text style={styles.optionsSubtitle}>
                      {manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' 
                        ? 'Tap the checkmark to mark the correct answer' 
                        : 'Tap the checkmark to mark the correct answer'
                      }
                    </Text>
                    
                    {manualQuizQuestions[currentQuestionIndex].questionType === 'true-false' ? (
                      // True/False options
                      <>
                        <View style={styles.optionContainer}>
                          <View style={styles.optionInputContainer}>
                            <Text style={styles.optionLetter}>A</Text>
                            <Text style={styles.trueFalseOption}>True</Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.correctAnswerButton,
                              manualQuizQuestions[currentQuestionIndex].correctAnswer === 0 && 
                              styles.correctAnswerButtonActive
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
                        
                        <View style={styles.optionContainer}>
                          <View style={styles.optionInputContainer}>
                            <Text style={styles.optionLetter}>B</Text>
                            <Text style={styles.trueFalseOption}>False</Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.correctAnswerButton,
                              manualQuizQuestions[currentQuestionIndex].correctAnswer === 1 && 
                              styles.correctAnswerButtonActive
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
                        <View key={optionIndex} style={styles.optionContainer}>
                          <View style={styles.optionInputContainer}>
                            <Text style={styles.optionLetter}>
                              {String.fromCharCode(65 + optionIndex)}
                            </Text>
                            <TextInput
                              style={styles.optionInput}
                              value={option}
                              onChangeText={(text) => updateOption(currentQuestionIndex, optionIndex, text)}
                              placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                              placeholderTextColor="#9ca3af"
                            />
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.correctAnswerButton,
                              manualQuizQuestions[currentQuestionIndex].correctAnswer === optionIndex && 
                              styles.correctAnswerButtonActive
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

      {/* Practice Modal */}
      <Modal
        visible={practiceModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closePracticeModal}
      >
        <SafeAreaView style={styles.modalSafeAreView}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>
                  {practiceState.isComplete ? 'Quiz Complete!' : 'Practice Quiz'}
                </Text>
                <TouchableOpacity 
                  onPress={closePracticeModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              {selectedQuiz && (
                <Text style={styles.selectedNoteTitle}>
                  {selectedQuiz.title}
                </Text>
              )}
            </View>

            {practiceState.isComplete ? (
              // Results Screen
              <View style={styles.resultsContainer}>
                <View style={styles.resultsHeader}>
                  <Ionicons 
                    name={practiceState.score === practiceState.questions.length ? "trophy" : "star"} 
                    size={80} 
                    color={practiceState.score === practiceState.questions.length ? "#fbbf24" : "#10b981"} 
                  />
                  <Text style={styles.resultsTitle}>
                    {practiceState.score === practiceState.questions.length ? "Perfect Score!" : "Great Job!"}
                  </Text>
                  <Text style={styles.resultsScore}>
                    {practiceState.score} / {practiceState.questions.length} Correct
                  </Text>
                  <Text style={styles.resultsPercentage}>
                    {Math.round((practiceState.score / practiceState.questions.length) * 100)}%
                  </Text>
                </View>
                
                <View style={styles.resultsActions}>
                  <TouchableOpacity
                    style={styles.restartButton}
                    onPress={restartPractice}
                  >
                    <Ionicons name="refresh-outline" size={20} color="white" />
                    <Text style={styles.restartButtonText}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Question Screen
              <View style={styles.practiceContent}>
                {/* Progress Bar */}
                <View style={styles.progressSection}>
                  <Text style={styles.progressText}>
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
                  <Text style={styles.questionText}>
                    {practiceState.questions[practiceState.currentQuestionIndex]?.question}
                  </Text>
                </View>

                {/* Options */}
                <View style={styles.optionsContainer}>
                  {practiceState.questions[practiceState.currentQuestionIndex]?.options.map((option, index) => {
                    const isSelected = practiceState.userAnswers[practiceState.currentQuestionIndex] === index;
                    const isCorrect = index === practiceState.questions[practiceState.currentQuestionIndex]?.correctAnswer;
                    const showCorrect = practiceState.showAnswers;
                    
                    let optionStyle = styles.optionButton;
                    if (isSelected && showCorrect) {
                      optionStyle = isCorrect ? styles.optionButtonCorrect : styles.optionButtonIncorrect;
                    } else if (showCorrect && isCorrect) {
                      optionStyle = styles.optionButtonCorrect;
                    } else if (isSelected) {
                      optionStyle = styles.optionButtonSelected;
                    }

                    return (
                      <TouchableOpacity
                        key={index}
                        style={optionStyle}
                        onPress={() => !practiceState.showAnswers && selectAnswer(index)}
                        disabled={practiceState.showAnswers}
                      >
                        <Text style={styles.optionLetter}>
                          {String.fromCharCode(65 + index)}
                        </Text>
                        <Text style={styles.optionText}>{option}</Text>
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
                  {!practiceState.showAnswers ? (
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        practiceState.userAnswers[practiceState.currentQuestionIndex] === -1 && styles.actionButtonDisabled
                      ]}
                      onPress={showAnswer}
                      disabled={practiceState.userAnswers[practiceState.currentQuestionIndex] === -1}
                    >
                      <Ionicons name="eye-outline" size={20} color="white" />
                      <Text style={styles.actionButtonText}>Check Answer</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.navigationButtons}>
                      <TouchableOpacity
                        style={[
                          styles.navButton,
                          practiceState.currentQuestionIndex === 0 && styles.navButtonDisabled
                        ]}
                        onPress={previousQuestion}
                        disabled={practiceState.currentQuestionIndex === 0}
                      >
                        <Ionicons name="chevron-back" size={20} color="#6b7280" />
                        <Text style={styles.navButtonText}>Previous</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.navButton}
                        onPress={nextQuestion}
                      >
                        <Text style={styles.navButtonText}>
                          {practiceState.currentQuestionIndex === practiceState.questions.length - 1 ? 'Finish' : 'Next'}
                        </Text>
                        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {practiceModeSelectVisible && (
        <Modal
          visible={practiceModeSelectVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setPracticeModeSelectVisible(false)}
        >
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', width: 320 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 16 }}>Choose Practice Mode</Text>
              <TouchableOpacity
                style={{ backgroundColor: '#f093fb', padding: 16, borderRadius: 8, marginBottom: 16, width: '100%', alignItems: 'center' }}
                onPress={() => { setPracticeModeSelectVisible(false); startPractice(selectedQuiz!, 'per-question'); }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Check After Each Question</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ backgroundColor: '#10b981', padding: 16, borderRadius: 8, width: '100%', alignItems: 'center' }}
                onPress={() => { setPracticeModeSelectVisible(false); startPractice(selectedQuiz!, 'all-at-once'); }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Check After All Questions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginTop: 16 }}
                onPress={() => setPracticeModeSelectVisible(false)}
              >
                <Text style={{ color: '#ef4444', fontWeight: '500' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
  imageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
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
  modalSafeAreView: {
    flex: 1,
    backgroundColor: 'white'
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 12 : 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  selectedNoteTitle: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  settingsSection: {
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  quizTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quizTypeButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  quizTypeButtonActive: {
    backgroundColor: '#f093fb',
    borderColor: '#f093fb',
  },
  quizTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  quizTypeButtonTextActive: {
    color: 'white',
  },
  questionCountButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  questionCountButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  questionCountButtonActive: {
    backgroundColor: '#f093fb',
    borderColor: '#f093fb',
  },
  questionCountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  questionCountButtonTextActive: {
    color: 'white',
  },
  generateButton: {
    backgroundColor: '#f093fb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  generateButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  progressContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#f093fb',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  quizSection: {
    marginBottom: 24,
  },
  quizContent: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quizText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  scanButton: {
    padding: 4,
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
  scanSection: {
    marginBottom: 24,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  scanButtonIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    padding: 8,
    borderRadius: 6,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  scanButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  imageSection: {
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    minHeight: 180,
  },
  previewImage: {
    width: '100%',
    height: 240,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 6,
  },
  extractedTextSection: {
    marginBottom: 24,
  },
  extractedTextContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  extractedTextContent: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  quizSettingsSection: {
    marginBottom: 24,
  },
  generateButtonSection: {
    marginTop: 16,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#f093fb',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualQuizButton: {
    padding: 4,
    marginLeft: 8,
  },
  formSection: {
    marginVertical: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  contentInputContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  contentInput: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
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
  resetButton: {
    padding: 4,
    marginLeft: 8,
  },
  emptyNote: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
  },
  questionNavigation: {
    marginBottom: 24,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  questionTabActive: {
    backgroundColor: '#f093fb',
    borderColor: '#f093fb',
  },
  questionTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  questionTabTextActive: {
    color: 'white',
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
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: '#111827',
  },
  removeQuestionButton: {
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  questionInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#374151',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  optionsSection: {
    marginTop: 16,
  },
  optionsSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: '#374151',
    paddingVertical: 4,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  correctAnswerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  correctAnswerButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
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
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  questionTypeButtonActive: {
    backgroundColor: '#f093fb',
    borderColor: '#f093fb',
  },
  questionTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  questionTypeButtonTextActive: {
    color: 'white',
  },
  trueFalseOption: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  resultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  resultsHeader: {
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  resultsScore: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  resultsPercentage: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  resultsActions: {
    marginTop: 24,
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
  practiceContent: {
    flex: 1,
    padding: 40,
  },
  progressSection: {
    marginBottom: 24,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  optionButtonCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 8,
    backgroundColor: '#d1fae5',
  },
  optionButtonIncorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  optionButtonSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 2,
    borderColor: '#f093fb',
    borderRadius: 8,
    backgroundColor: '#f0f0ff',
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
    backgroundColor: '#f0f0ff',
  },
  navButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  practiceButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default QuizMaker;
