import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
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
import { processImage } from '../services/geminiServices';
import { addHistory, addScanNote, getAllScanNotes, spendCredits } from '../services/historyStorage';

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

const StudyNotes = () => {
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

  // New state for picker modal
  const [showPickerModal, setShowPickerModal] = useState(false);

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
      
      // Enhanced notes with word count
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
    // Fade in animation
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
            'Please grant camera permission to scan documents. You can enable it in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Settings', 
                onPress: () => {
                  // In a real app, you'd open device settings
                  console.log('Open device settings');
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
      
      // Check credits first
      const hasEnoughCredits = await spendCredits(1);
      if (!hasEnoughCredits) {
        return {
          success: false,
          error: 'Insufficient credits. Please purchase more credits to continue scanning.'
        };
      }

      setScanState(prev => ({ ...prev, progress: 30 }));

      // Process image with Gemini
      const extractedText = await processImage(uri);
      
      setScanState(prev => ({ ...prev, progress: 80 }));

      if (!extractedText || extractedText.trim().length === 0) {
        return {
          success: false,
          error: 'No text could be detected in the image. Please try with a clearer image containing text.'
        };
      }

      // Simulate confidence calculation (in real app, this might come from the AI service)
      const confidence = Math.min(95, Math.max(60, extractedText.length / 10));
      
      setScanState(prev => ({ ...prev, progress: 100 }));

      return {
        success: true,
        text: extractedText,
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
    
    // Process the image
    const scanResult = await processImageScan(asset.uri);
    
    if (scanResult.success && scanResult.text) {
      setExtractedText(scanResult.text);
      setScanConfidence(scanResult.confidence || 0);
      setNoteTitle('Scanned Document');
      setNoteContent(scanResult.text);
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
      
      await addScanNote(noteTitle.trim(), noteContent.trim());
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
        'Your note has been saved successfully.',
        [{ text: 'OK' }],
        { cancelable: false }
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

  const renderNoteItem = ({ item, index }: { item: ScanNote; index: number }) => (
    <Animated.View
      style={[
        styles.noteCard,
        {
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0]
            })
          }],
          opacity: fadeAnim
        }
      ]}
    >
      <TouchableOpacity 
        onPress={() => openNotePreview(item)}
        activeOpacity={0.8}
        style={styles.noteCardContent}
      >
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
          {item.imageUri && (
            <View style={styles.imageIndicator}>
              <Ionicons name="image" size={14} color="#667eea" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Animated.View
        style={[
          styles.emptyIconContainer,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Ionicons name="scan-outline" size={80} color="#e0e7ff" />
      </Animated.View>
      <Text style={styles.emptyTitle}>Start Scanning!</Text>
      <Text style={styles.emptySubtitle}>
        Capture text from images, documents, and handwritten notes
      </Text>
      <TouchableOpacity 
        style={styles.primaryButton}
        onPress={openScanPicker}
        activeOpacity={0.8}
      >
        <Ionicons name="camera-outline" size={20} color="#fff" />
        <Text style={styles.primaryButtonText}>Scan Your First Note</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => {
    if (!error.type) return null;
    
    return (
      <View style={styles.errorBanner}>
        <View style={styles.errorContent}>
          <Ionicons 
            name="warning-outline" 
            size={20} 
            color="#dc2626" 
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
          <Ionicons name="close" size={16} color="#dc2626" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderScanProgress = () => {
    if (!scanState.isProcessing) return null;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Ionicons name="document-text-outline" size={24} color="#667eea" />
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
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={styles.scanResultsTitle}>Text Extracted Successfully</Text>
          {scanConfidence > 0 && (
            <Text style={styles.confidenceScore}>
              {Math.round(scanConfidence)}% confidence
            </Text>
          )}
        </View>
        <View style={styles.extractedTextPreview}>
          <Text style={styles.extractedText} numberOfLines={3}>
            {extractedText}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scan Notes</Text>
        <Text style={styles.headerSubtitle}>
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </Text>
      </View>

      {/* Error Banner */}
      {renderError()}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading your notes...</Text>
        </View>
      ) : notes.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={notes}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          renderItem={renderNoteItem}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => clearError()}
        />
      )}

      {/* Floating Action Button */}
      {notes.length > 0 && (
        <TouchableOpacity 
          style={styles.fab} 
          onPress={openScanPicker}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Scan Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeScanModal}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              { opacity: fadeAnim }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.dragHandle} />
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Scan Document</Text>
                <TouchableOpacity 
                  onPress={closeScanModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Scan Buttons */}
              <View style={styles.scanSection}>
                <Text style={styles.sectionTitle}>Choose Source</Text>
                <View style={styles.scanButtons}>
                  <TouchableOpacity 
                    style={[
                      styles.scanButton,
                      scanState.isScanning && styles.scanButtonDisabled
                    ]}
                    onPress={handleCameraScan}
                    disabled={scanState.isScanning || scanState.isProcessing}
                  >
                    <Ionicons name="camera-outline" size={24} color="#667eea" />
                    <Text style={styles.scanButtonText}>Camera</Text>
                    <Text style={styles.scanButtonSubtext}>Take a photo</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.scanButton,
                      scanState.isScanning && styles.scanButtonDisabled
                    ]}
                    onPress={handleGalleryScan}
                    disabled={scanState.isScanning || scanState.isProcessing}
                  >
                    <Ionicons name="image-outline" size={24} color="#667eea" />
                    <Text style={styles.scanButtonText}>Gallery</Text>
                    <Text style={styles.scanButtonSubtext}>Choose image</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Image Preview */}
              {imageUri && (
                <View style={styles.imageSection}>
                  <Text style={styles.sectionTitle}>Scanned Image</Text>
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => {
                        setImageUri(null);
                        setExtractedText('');
                        setNoteContent('');
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
              {(noteContent || noteTitle) && (
                <View style={styles.formSection}>
                  <Text style={styles.sectionTitle}>Edit Note</Text>
                  
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
              )}
            </ScrollView>

            {/* Save Button */}
            {(noteContent || noteTitle) && (
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
                    <Ionicons name="save-outline" size={20} color="white" />
                  )}
                  <Text style={styles.saveButtonText}>
                    {scanState.isSaving ? 'Saving...' : 'Save Note'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
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
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: 'white', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 20 }}>Choose Image Source</Text>
              <TouchableOpacity style={{ paddingVertical: 16 }} onPress={() => { setShowPickerModal(false); handleCameraScan(); }}>
                <Text style={{ fontSize: 16 }}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 16 }} onPress={() => { setShowPickerModal(false); handleGalleryScan(); }}>
                <Text style={{ fontSize: 16 }}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingVertical: 16 }} onPress={() => setShowPickerModal(false)}>
                <Text style={{ fontSize: 16, color: '#ff6b6b' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
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
    color: '#667eea',
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
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  noteCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noteCardContent: {
    padding: 20,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    flex: 1,
    marginRight: 12,
  },
  noteMetadata: {
    alignItems: 'flex-end',
  },
  wordCount: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  noteContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 16,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  imageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    backgroundColor: '#667eea',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#dc2626',
    marginLeft: 8,
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#dc2626',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
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
    color: '#374151',
    marginBottom: 12,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonDisabled: {
    opacity: 0.5,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginTop: 8,
  },
  scanButtonSubtext: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  imageSection: {
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f1f5f9',
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
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  scanResults: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  scanResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#16a34a',
    marginLeft: 8,
    flex: 1,
  },
  confidenceScore: {
    fontSize: 12,
    color: '#16a34a',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  extractedTextPreview: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  extractedText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  formSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1e293b',
  },
  contentInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#1e293b',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  saveSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: 'white',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
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
});

export default StudyNotes;