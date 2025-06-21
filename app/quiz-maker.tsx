import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
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
  number_of_questions: number;
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

type QuizType = 'multiple-choice' | 'true-false' | 'fill-blank';

const QuizMaker = () => {
  // State management
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  
  // Quiz generation state
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<string>('');
  const [selectedQuizType, setSelectedQuizType] = useState<QuizType>('multiple-choice');
  const [numberOfQuestions, setNumberOfQuestions] = useState<number>(5);
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
  const [manualQuizContent, setManualQuizContent] = useState('');
  const [manualQuizType, setManualQuizType] = useState<QuizType>('multiple-choice');
  const [manualQuizQuestions, setManualQuizQuestions] = useState<number>(5);
  const [isSavingManualQuiz, setIsSavingManualQuiz] = useState(false);
  
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
        handleError('credits', 'Insufficient credits. You need 1 credit to scan and 2 credits to generate quiz.', false);
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
        handleError('credits', 'You need 2 credits to generate a quiz. Please purchase more credits.', false);
        return;
      }

      setQuizState(prev => ({ ...prev, progress: 30 }));

      const quiz = await generateQuizFromNotes(
        selectedQuiz.content,
        selectedQuizType,
        numberOfQuestions
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
        numberOfQuestions,
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
        handleError('credits', 'You need 2 credits to generate a quiz. Please purchase more credits.', false);
        return;
      }

      setQuizState(prev => ({ ...prev, progress: 30 }));

      const quiz = await generateQuizFromNotes(
        extractedText,
        selectedQuizType,
        numberOfQuestions
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
        numberOfQuestions
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
    setManualQuizContent('');
    setManualQuizType('multiple-choice');
    setManualQuizQuestions(5);
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
    setManualQuizContent('');
    setManualQuizType('multiple-choice');
    setManualQuizQuestions(5);
  };

  const saveManualQuiz = async () => {
    if (!manualQuizTitle.trim() || !manualQuizContent.trim()) {
      Alert.alert('Error', 'Please fill in both title and content for the quiz.');
      return;
    }

    try {
      setIsSavingManualQuiz(true);
      
      await addQuiz(
        manualQuizTitle.trim(),
        manualQuizContent.trim(),
        manualQuizType,
        manualQuizQuestions
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

                  <View style={styles.settingGroup}>
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
                  </View>

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

                  <View style={styles.settingGroup}>
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
                  </View>
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
                <Text style={styles.modalTitle}>Create Manual Quiz</Text>
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
              {/* Quiz Form */}
              <View style={styles.formSection}>
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

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Quiz Content</Text>
                  <View style={styles.contentInputContainer}>
                    <TextInput
                      style={styles.contentInput}
                      value={manualQuizContent}
                      onChangeText={setManualQuizContent}
                      placeholder="Enter your quiz content here...&#10;&#10;Example:&#10;1. What is the capital of France?&#10;   A) London&#10;   B) Paris&#10;   C) Berlin&#10;   D) Madrid&#10;&#10;2. Which planet is closest to the Sun?&#10;   A) Venus&#10;   B) Earth&#10;   C) Mercury&#10;   D) Mars&#10;&#10;ANSWERS:&#10;1. B) Paris&#10;2. C) Mercury"
                      placeholderTextColor="#9ca3af"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                <View style={styles.settingGroup}>
                  <Text style={styles.settingLabel}>Quiz Type</Text>
                  <View style={styles.quizTypeButtons}>
                    {(['multiple-choice', 'true-false', 'fill-blank'] as QuizType[]).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.quizTypeButton,
                          manualQuizType === type && styles.quizTypeButtonActive
                        ]}
                        onPress={() => setManualQuizType(type)}
                      >
                        <Text style={[
                          styles.quizTypeButtonText,
                          manualQuizType === type && styles.quizTypeButtonTextActive
                        ]}>
                          {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.settingGroup}>
                  <Text style={styles.settingLabel}>Number of Questions</Text>
                  <View style={styles.questionCountButtons}>
                    {[3, 5, 10, 15].map((count) => (
                      <TouchableOpacity
                        key={count}
                        style={[
                          styles.questionCountButton,
                          manualQuizQuestions === count && styles.questionCountButtonActive
                        ]}
                        onPress={() => setManualQuizQuestions(count)}
                      >
                        <Text style={[
                          styles.questionCountButtonText,
                          manualQuizQuestions === count && styles.questionCountButtonTextActive
                        ]}>
                          {count}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

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
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
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
});

export default QuizMaker;
