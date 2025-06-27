import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
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
import AppendScanModal from '../components/AppendScanModal';
import NoteReaderModal from '../components/NoteReaderModal';
import { generateQuizFromNotes, processImage } from '../services/geminiServices';
import { addHistory, addQuiz, addScanNote, deleteScanNote, getAllScanNotes, spendCredits, updateScanNote } from '../services/historyStorage';

const { width, height } = Dimensions.get('window');

// Enhanced interfaces
interface ScanNote {
  id: number;
  title: string;
  content: string;
  imageUri?: string;
  createdAt: Date;
  wordCount: number;
  tags?: string[];
}

interface ScanState {
  isScanning: boolean;
  isProcessing: boolean;
  isSaving: boolean;
  progress: number;
}

interface ErrorState {
  type: 'camera' | 'processing' | 'saving' | 'credits' | 'network' | null;
  message: string;
  code?: string;
  retryable: boolean;
}

interface ImageScanResult {
  success: boolean;
  text?: string;
  confidence?: number;
  error?: string;
}

type QuizType = 'multiple-choice' | 'true-false' | 'fill-blank';

const StudyNotes = () => {
  const router = useRouter();
  
  // State management
  const [notes, setNotes] = useState<ScanNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ScanNote | null>(null);
  
  // Scan state
  const [scanState, setScanState] = useState<ScanState>({
    isScanning: false,
    isProcessing: false,
    isSaving: false,
    progress: 0
  });
  
  // Error handling
  const [error, setError] = useState<ErrorState>({
    type: null,
    message: '',
    retryable: false
  });
  
  // Form state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [scanConfidence, setScanConfidence] = useState<number>(0);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  // New state for picker modal
  const [showPickerModal, setShowPickerModal] = useState(false);

  // Add state for append modal
  const [appendModalVisible, setAppendModalVisible] = useState(false);
  const [noteToAppend, setNoteToAppend] = useState<ScanNote | null>(null);

  // Quiz generation state
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<string>('');
  const [selectedQuizType, setSelectedQuizType] = useState<QuizType>('multiple-choice');
  const [numberOfQuestions, setNumberOfQuestions] = useState<number>(5);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Enhanced error handling
  const handleError = (type: ErrorState['type'], message: string, retryable: boolean = true, code?: string) => {
    setError({ type, message, retryable, code });
    if (Platform.OS !== 'web') {
      Vibration.vibrate(100);
    }
  };

  const clearError = () => {
    setError({ type: null, message: '', retryable: false });
  };

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      const scanNotes = await getAllScanNotes();
      
      const enhancedNotes = scanNotes.map(note => ({
        ...note,
        createdAt: new Date(note.createdAt),
        wordCount: note.content.split(/\s+/).filter(word => word.length > 0).length
      }));
      
      setNotes(enhancedNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
      handleError('network', 'Failed to load notes. Please check your connection and try again.', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const resetModalState = () => {
    clearError();
    setImageUri(null);
    setNoteTitle('');
    setNoteContent('');
    setExtractedText('');
    setScanConfidence(0);
    setScanState({
      isScanning: false,
      isProcessing: false,
      isSaving: false,
      progress: 0
    });
  };

  const openScanModal = () => {
    resetModalState();
    setModalVisible(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const openScanPicker = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Camera', 'Gallery'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) handleCameraScan();
          if (buttonIndex === 2) handleGalleryScan();
        }
      );
    } else {
      setShowPickerModal(true);
    }
  };

  const closeScanModal = () => {
    if (scanState.isProcessing || scanState.isSaving) {
      Alert.alert(
        'Operation in Progress',
        'Please wait for the current operation to complete.',
        [{ text: 'OK' }]
      );
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      resetModalState();
    });
  };

  const requestPermissions = async (): Promise<boolean> => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Required',
            'Please grant camera permission to scan documents.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Settings', 
                onPress: () => {
                  // Open device settings
                }
              }
            ]
          );
          return false;
        }
      }
      return true;
    } catch (error) {
      handleError('camera', 'Failed to request camera permissions.', true);
      return false;
    }
  };

  const processImageScan = async (uri: string): Promise<ImageScanResult> => {
    try {
      setScanState(prev => ({ ...prev, isProcessing: true, progress: 10 }));
      
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
        setScanState(prev => ({ ...prev, isProcessing: false, progress: 0 }));
        return { success: false, error: 'Insufficient credits' };
      }

      setScanState(prev => ({ ...prev, progress: 30 }));
      const text = await processImage(uri);
      
      setScanState(prev => ({ ...prev, progress: 80 }));

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          error: 'No text could be detected in the image. Please try with a clearer image.'
        };
      }

      const confidence = Math.min(95, Math.max(60, text.length / 10));
      
      setScanState(prev => ({ ...prev, progress: 100 }));

      return {
        success: true,
        text: text,
        confidence: confidence
      };

    } catch (error) {
      console.error('Image processing error:', error);
      return {
        success: false,
        error: 'Failed to process the image. Please try again with a clearer image.'
      };
    } finally {
      setScanState(prev => ({ ...prev, isProcessing: false, progress: 0 }));
    }
  };

  const handleImageSelection = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      handleError('processing', 'Invalid image selected. Please try again.', true);
      return;
    }

    setImageUri(asset.uri);
    
    const scanResult = await processImageScan(asset.uri);
    
    if (scanResult.success && scanResult.text) {
      setExtractedText(scanResult.text);
      setScanConfidence(scanResult.confidence || 0);
      
      const defaultTitle = 'Scanned Document';
      const extractedContent = scanResult.text.trim();
      
      setNoteTitle(defaultTitle);
      setNoteContent(extractedContent);
      clearError();
    } else {
      handleError('processing', scanResult.error || 'Failed to extract text from image.', true);
    }
  };

  const handleCameraScan = async () => {
    try {
      clearError();
      setScanState(prev => ({ ...prev, isScanning: true }));

      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        setScanState(prev => ({ ...prev, isScanning: false }));
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.9,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      await handleImageSelection(result);
    } catch (error) {
      console.error('Camera error:', error);
      handleError('camera', 'Failed to capture image. Please try again.', true);
    } finally {
      setScanState(prev => ({ ...prev, isScanning: false }));
    }
  };

  const handleGalleryScan = async () => {
    try {
      clearError();
      setScanState(prev => ({ ...prev, isScanning: true }));

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.9,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      await handleImageSelection(result);
    } catch (error) {
      console.error('Gallery error:', error);
      handleError('processing', 'Failed to select image from gallery. Please try again.', true);
    } finally {
      setScanState(prev => ({ ...prev, isScanning: false }));
    }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      handleError('saving', 'Please enter a title for your note.', false);
      return;
    }
    
    if (!noteContent.trim()) {
      handleError('saving', 'Note content cannot be empty.', false);
      return;
    }

    try {
      setScanState(prev => ({ ...prev, isSaving: true }));
      clearError();
      
      const noteId = await addScanNote(noteTitle.trim(), noteContent.trim());
      await addHistory('', 'scan-notes', noteTitle.trim(), noteContent.trim());
      
      closeScanModal();
      await loadNotes();
      
      // Success animation
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true })
      ]).start();
      
      Alert.alert(
        'Success!', 
        'Your study note has been saved successfully.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Save note error:', error);
      handleError('saving', 'Failed to save note. Please try again.', true);
    } finally {
      setScanState(prev => ({ ...prev, isSaving: false }));
    }
  };

  const retryLastAction = () => {
    switch (error.type) {
      case 'camera':
        handleCameraScan();
        break;
      case 'processing':
        if (imageUri) {
          processImageScan(imageUri);
        }
        break;
      case 'saving':
        handleSaveNote();
        break;
      case 'network':
        loadNotes();
        break;
      default:
        clearError();
    }
  };

  const openNotePreview = (note: ScanNote) => {
    setSelectedNote(note);
    setPreviewModalVisible(true);
  };

  const handleDeleteNote = (note: ScanNote) => {
    Alert.alert(
      'Delete Scan Note',
      'Are you sure you want to delete this scan note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteScanNote(note.id);
              await loadNotes(); // Refresh the list
              Alert.alert('Success', 'Scan note deleted successfully.');
            } catch (error) {
              console.error('Failed to delete scan note:', error);
              Alert.alert('Error', 'Failed to delete scan note. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Handler to open append modal
  const openAppendModal = (note: ScanNote) => {
    setNoteToAppend(note);
    setAppendModalVisible(true);
  };

  // Handler to update note content
  const handleAppendToNote = async (newContent: string) => {
    if (!noteToAppend) return;
    try {
      await updateScanNote(noteToAppend.id, noteToAppend.title, newContent);
      await loadNotes();
      Alert.alert('Success', 'Content appended to note successfully.');
    } catch (error) {
      Alert.alert('Error', 'Failed to append content.');
    }
  };

  // Quiz generation handlers
  const openQuizModal = (note: ScanNote) => {
    setSelectedNote(note);
    setQuizModalVisible(true);
    setGeneratedQuiz('');
  };

  const closeQuizModal = () => {
    if (isGeneratingQuiz) {
      Alert.alert(
        'Generation in Progress',
        'Please wait for the quiz generation to complete.',
        [{ text: 'OK' }]
      );
      return;
    }
    setQuizModalVisible(false);
    setSelectedNote(null);
    setGeneratedQuiz('');
  };

  const generateQuiz = async () => {
    if (!selectedNote) return;

    try {
      setIsGeneratingQuiz(true);
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
        setIsGeneratingQuiz(false);
        return;
      }

      const quiz = await generateQuizFromNotes(
        selectedNote.content,
        selectedQuizType,
        numberOfQuestions
      );

      setGeneratedQuiz(quiz);

    } catch (error) {
      console.error('Quiz generation error:', error);
      Alert.alert('Error', 'Failed to generate quiz. Please try again.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const saveGeneratedQuiz = async () => {
    if (!generatedQuiz || !selectedNote) return;

    try {
      const quizTitle = `${selectedNote.title} - ${selectedQuizType.replace('-', ' ')} Quiz`;
      
      await addQuiz(
        quizTitle,
        generatedQuiz,
        selectedQuizType,
        numberOfQuestions,
        selectedNote.id,
        'scan-note'
      );

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

  const renderNoteItem = ({ item }: { item: ScanNote }) => (
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
              <Text style={styles.wordCount}>{item.wordCount} words</Text>
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
              {new Date(item.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
            <View style={styles.noteActions}>
              {item.imageUri && (
                <View style={styles.imageIndicator}>
                  <Ionicons name="image" size={14} color="#6366f1" />
                </View>
              )}
              <TouchableOpacity 
                style={styles.editButton}
                onPress={(e) => {
                  e.stopPropagation();
                  router.push(`/note/${item.id}` as any);
                }}
              >
                <Ionicons name="create-outline" size={16} color="#6366f1" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteNote(item);
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.appendButton}
                onPress={() => openAppendModal(item)}
              >
                <Ionicons name="add-circle-outline" size={16} color="#10b981" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quizButton}
                onPress={(e) => {
                  e.stopPropagation();
                  openQuizModal(item);
                }}
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
        <Ionicons name="document-text-outline" size={80} color="#e0e7ff" />
      </Animated.View>
      <Text style={styles.emptyTitle}>No Study Notes Yet</Text>
      <Text style={styles.emptySubtitle}>
        Scan documents or images to create your first study note
      </Text>
      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={openScanPicker}
        activeOpacity={0.8}
      >
        <Ionicons name="scan-outline" size={20} color="#fff" />
        <Text style={styles.primaryButtonText}>Scan Document</Text>
      </TouchableOpacity>
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

  const renderScanProgress = () => {
    if (!scanState.isProcessing) return null;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Ionicons name="document-text-outline" size={24} color="#6366f1" />
          <Text style={styles.progressTitle}>Processing Image...</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar,
              { width: `${scanState.progress}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>{scanState.progress}% complete</Text>
      </View>
    );
  };

  const renderScanResults = () => {
    if (!extractedText) return null;
    
    return (
      <View style={styles.scanResults}>
        <View style={styles.scanResultsHeader}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={styles.scanResultsTitle}>Text Extracted</Text>
          {scanConfidence > 0 && (
            <Text style={styles.confidenceScore}>
              {Math.round(scanConfidence)}% confidence
            </Text>
          )}
        </View>
        <View style={styles.extractedTextPreview}>
          <Text style={styles.extractedText} numberOfLines={5}>
            {extractedText.substring(0, 200)}...
          </Text>
          <Text style={styles.extractedTextNote}>
            Full text available in note content
          </Text>
        </View>
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
            <Text style={styles.headerTitle}>Study Notes</Text>
            <Text style={styles.headerSubtitle}>
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.newNoteButton}
            onPress={openScanModal}
          >
            <Ionicons name="add" size={24} color="#6366f1" />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Error Banner */}
      {renderError()}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading your notes...</Text>
        </View>
      ) : notes.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.FlatList
          data={notes}
          keyExtractor={item => item.id.toString()}
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

      {/* Scan Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeScanModal}
      >
        <SafeAreaView style={styles.modalSafeAreView}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{flex: 1}}
          >
            <Animated.View 
              style={[
                styles.modalContainer,
                { opacity: fadeAnim }
              ]}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.modalTitle}>Create Study Note</Text>
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
                keyboardShouldPersistTaps="handled"
              >
                {/* Scan Buttons - Only show if no image selected */}
                {!imageUri && (
                  <View style={styles.scanSection}>
                    <Text style={styles.sectionTitle}>Scan Document</Text>
                    <Text style={styles.sectionSubtitle}>
                      Take a photo or choose from gallery to extract text
                    </Text>
                    <View style={styles.scanButtons}>
                      <TouchableOpacity 
                        style={[
                          styles.scanButton,
                          scanState.isScanning && styles.scanButtonDisabled
                        ]}
                        onPress={handleCameraScan}
                        disabled={scanState.isScanning || scanState.isProcessing}
                      >
                        <View style={styles.scanButtonIcon}>
                          <Ionicons name="camera-outline" size={28} color="#6366f1" />
                        </View>
                        <Text style={styles.scanButtonText}>Camera</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.scanButton,
                          scanState.isScanning && styles.scanButtonDisabled
                        ]}
                        onPress={handleGalleryScan}
                        disabled={scanState.isScanning || scanState.isProcessing}
                      >
                        <View style={styles.scanButtonIcon}>
                          <Ionicons name="image-outline" size={28} color="#6366f1" />
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
                          setNoteContent('');
                          setNoteTitle('');
                          clearError();
                        }}
                      >
                        <Ionicons name="close" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Processing Progress */}
                {renderScanProgress()}

                {/* Scan Results */}
                {renderScanResults()}

                {/* Note Form */}
                {(extractedText || noteContent || noteTitle) && (
                  <View style={styles.formSection}>
                    <Text style={styles.sectionTitle}>Note Details</Text>
                    
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Title</Text>
                      <TextInput
                        style={styles.titleInput}
                        value={noteTitle}
                        onChangeText={setNoteTitle}
                        placeholder="Enter note title..."
                        placeholderTextColor="#9ca3af"
                        returnKeyType="next"
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Content</Text>
                      <View style={styles.contentInputContainer}>
                        <TextInput
                          style={styles.contentInput}
                          value={noteContent}
                          onChangeText={setNoteContent}
                          placeholder="Note content will appear here..."
                          placeholderTextColor="#9ca3af"
                          multiline
                          textAlignVertical="top"
                        />
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Save Button */}
              {(extractedText || noteContent || noteTitle) && (
                <View style={styles.saveSection}>
                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      scanState.isSaving && styles.saveButtonDisabled
                    ]}
                    onPress={handleSaveNote}
                    disabled={scanState.isSaving}
                  >
                    {scanState.isSaving ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={20} color="white" />
                        <Text style={styles.saveButtonText}>
                          Save Note
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Note Preview Modal */}
      <NoteReaderModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        note={selectedNote}
        isScanNote={true}
      />

      {/* Picker Modal for Android/web */}
      {showPickerModal && (
        <Modal
          transparent
          animationType="fade"
          visible={showPickerModal}
          onRequestClose={() => setShowPickerModal(false)}
        >
          <TouchableOpacity 
            style={styles.pickerModalOverlay}
            activeOpacity={1}
            onPress={() => setShowPickerModal(false)}
          >
            <View style={styles.pickerModalContainer}>
              <TouchableOpacity 
                style={styles.pickerOption} 
                onPress={() => { setShowPickerModal(false); handleCameraScan(); }}
              >
                <Ionicons name="camera-outline" size={24} color="#6366f1" />
                <Text style={styles.pickerOptionText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.pickerOption} 
                onPress={() => { setShowPickerModal(false); handleGalleryScan(); }}
              >
                <Ionicons name="image-outline" size={24} color="#6366f1" />
                <Text style={styles.pickerOptionText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.pickerCancel} 
                onPress={() => setShowPickerModal(false)}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Append Scan Modal */}
      <AppendScanModal
        visible={appendModalVisible}
        onClose={() => setAppendModalVisible(false)}
        onAppend={handleAppendToNote}
        existingContent={noteToAppend?.content || ''}
        noteTitle={noteToAppend?.title || ''}
      />

      {/* Quiz Modal */}
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
              {selectedNote && (
                <Text style={styles.selectedNoteTitle}>
                  From: {selectedNote.title}
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
                      isGeneratingQuiz && styles.generateButtonDisabled
                    ]}
                    onPress={generateQuiz}
                    disabled={isGeneratingQuiz}
                  >
                    {isGeneratingQuiz ? (
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

              {/* Generated Quiz */}
              {generatedQuiz && (
                <View style={styles.generateQuizSection}>
                  <Text style={styles.sectionTitle}>Generated Quiz</Text>
                  <View style={styles.generatedQuizContainer}>
                    <Text style={styles.generatedQuizText}>{generatedQuiz}</Text>
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
  newNoteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
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
    color: '#6366f1',
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
    backgroundColor: '#eef2ff',
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
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    color: '#6366f1',
    fontWeight: '600',
    backgroundColor: '#eef2ff',
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
    backgroundColor: '#eef2ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fabContainer: {
    position: 'absolute',
    right: 24,
    bottom: 24,
  },
  fab: {
    backgroundColor: '#6366f1',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
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
    paddingBottom: Platform.OS === 'ios' ? 0 : 20,
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scanSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  scanButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  scanButtonDisabled: {
    opacity: 0.5,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
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
    backgroundColor: '#6366f1',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  scanResults: {
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  scanResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanResultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 8,
    flex: 1,
  },
  confidenceScore: {
    fontSize: 12,
    color: '#059669',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  extractedTextPreview: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
  },
  extractedText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  extractedTextNote: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  formSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  contentInputContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    minHeight: 120,
  },
  contentInput: {
    padding: 16,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  saveSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: 'white',
  },
  saveButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#9ca3af',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 32,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 16,
  },
  pickerCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
  noteActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 4,
    marginLeft: 8,
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  swipeDeleteButton: {
    padding: 12,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    marginLeft: 8,
  },
  appendButton: {
    padding: 4,
    marginLeft: 8,
  },
  quizButton: {
    padding: 4,
    marginLeft: 8,
  },
  settingsSection: {
    marginVertical: 24,
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
  generateQuizSection: {
    marginBottom: 24,
  },
  generatedQuizContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  generatedQuizText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  selectedNoteTitle: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
});

export default StudyNotes;