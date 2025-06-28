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
import FlashCardGenerationModal from '../components/FlashCardGenerationModal';
import FlashCardViewer from '../components/FlashCardViewer';
import { processImage } from '../services/geminiServices';
import { addFlashCardSet, FlashCardSet, getAllFlashCardSets, resetFlashCardSetTable, spendCredits } from '../services/historyStorage';

const { width, height } = Dimensions.get('window');

// Enhanced interfaces
interface FlashCardState {
  isGenerating: boolean;
  progress: number;
}

interface ErrorState {
  type: 'generating' | 'credits' | 'network' | 'scanning' | null;
  message: string;
  retryable: boolean;
}

type CardType = 'term-definition' | 'question-answer';

const FlashCardMaker = () => {
  const router = useRouter();
  // State management
  const [flashCardSets, setFlashCardSets] = useState<FlashCardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSet, setSelectedSet] = useState<FlashCardSet | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  
  // FlashCard generation modal state
  const [generationModalVisible, setGenerationModalVisible] = useState(false);
  
  // FlashCard viewer modal state
  const [viewerModalVisible, setViewerModalVisible] = useState(false);
  
  // Scan state for direct generation
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  
  // Manual creation state
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [manualCardType, setManualCardType] = useState<CardType>('term-definition');
  const [isSavingManual, setIsSavingManual] = useState(false);
  
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

  const loadFlashCardSets = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      
      const setsData = await getAllFlashCardSets();
      
      const enhancedSets = setsData.map(set => ({
        ...set,
        createdAt: new Date(set.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      }));
      
      setFlashCardSets(enhancedSets);
    } catch (error) {
      console.error('Failed to load flash card sets:', error);
      handleError('network', 'Failed to load sets. Please check your connection and try again.', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFlashCardSets();
    }, [loadFlashCardSets])
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

  const openGenerationModal = (set: FlashCardSet) => {
    setSelectedSet(set);
    setGenerationModalVisible(true);
    clearError();
  };

  const closeGenerationModal = () => {
    setGenerationModalVisible(false);
    setSelectedSet(null);
    clearError();
  };

  const handleFlashCardSaved = () => {
    loadFlashCardSets();
  };

  const openManualModal = () => {
    setManualTitle('');
    setManualContent('');
    setManualCardType('term-definition');
    setManualModalVisible(true);
  };

  const closeManualModal = () => {
    if (isSavingManual) {
      Alert.alert(
        'Saving in Progress',
        'Please wait for the set to be saved.',
        [{ text: 'OK' }]
      );
      return;
    }
    setManualModalVisible(false);
  };

  const saveManualSet = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) {
      Alert.alert('Error', 'Please fill in both title and content for the set.');
      return;
    }

    try {
      setIsSavingManual(true);
      
      await addFlashCardSet(
        manualTitle.trim(),
        manualContent.trim(),
        manualCardType
      );

      await loadFlashCardSets();
      
      Alert.alert(
        'Success!', 
        'Flash card set has been saved successfully.',
        [{ text: 'OK' }]
      );
      
      closeManualModal();
    } catch (error) {
      console.error('Failed to save manual set:', error);
      Alert.alert('Error', 'Failed to save set. Please try again.');
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleResetTable = async () => {
    Alert.alert(
      'Reset Flash Card Sets',
      'This will delete all flash card sets and recreate the table. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetFlashCardSetTable();
              await loadFlashCardSets();
              Alert.alert('Success', 'Flash card sets table has been reset successfully.');
            } catch (error) {
              console.error('Failed to reset table:', error);
              Alert.alert('Error', 'Failed to reset table. Please try again.');
            }
          }
        }
      ]
    );
  };

  const openPreview = (set: FlashCardSet) => {
    setSelectedSet(set);
    setPreviewModalVisible(true);
  };

  const openFlashCardViewer = (set: FlashCardSet) => {
    setSelectedSet(set);
    setViewerModalVisible(true);
  };

  const parseFlashCards = (content: string): { front: string; back: string }[] => {
    return content
      .split('---')
      .map(cardBlock => {
        const frontMatch = cardBlock.match(/FRONT:\s*(.*)/);
        const backMatch = cardBlock.match(/BACK:\s*(.*)/);
        if (frontMatch && backMatch) {
          return { front: frontMatch[1].trim(), back: backMatch[1].trim() };
        }
        return null;
      })
      .filter(Boolean) as { front: string; back: string }[];
  };

  const retryLastAction = () => {
    switch (error.type) {
      case 'scanning':
        if (imageUri) {
          processScannedImage(imageUri);
        }
        break;
      case 'network':
        loadFlashCardSets();
        break;
      default:
        clearError();
    }
  };

  const renderSetItem = ({ item }: { item: FlashCardSet }) => (
    <View style={styles.noteCardContainer}>
      <TouchableOpacity 
        onPress={() => openPreview(item)}
        activeOpacity={0.8}
        style={styles.noteCard}
      >
        <View style={styles.noteCardContent}>
          <View style={styles.noteHeader}>
            <Text style={styles.noteTitle} numberOfLines={1} ellipsizeMode="tail">
              {item.title}
            </Text>
            <View style={styles.noteMetadata}>
              <Text style={styles.wordCount}>{item.card_type.replace('-', ' ')}</Text>
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
                onPress={(e) => {
                  e.stopPropagation();
                  openFlashCardViewer(item);
                }}
              >
                <Ionicons name="play-outline" size={16} color="#10b981" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quizButton}
                onPress={(e) => {
                  e.stopPropagation();
                  openGenerationModal(item);
                }}
              >
                <Ionicons name="copy-outline" size={16} color="#f093fb" />
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
        <Ionicons name="copy-outline" size={80} color="#f0f0ff" />
      </Animated.View>
      <Text style={styles.emptyTitle}>No Flash Card Sets</Text>
      <Text style={styles.emptySubtitle}>
        Generate sets from your notes, scan documents, or create them manually
      </Text>
      <View style={styles.emptyButtons}>
        <TouchableOpacity 
          style={styles.manualQuizEmptyButton}
          onPress={openManualModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add-outline" size={20} color="#fff" />
          <Text style={styles.manualQuizEmptyButtonText}>Create Set</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
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
            <Text style={styles.headerTitle}>Flash Card Maker</Text>
            <Text style={styles.headerSubtitle}>
              {flashCardSets.length} saved {flashCardSets.length === 1 ? 'set' : 'sets'}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.manualQuizButton}
              onPress={openManualModal}
            >
              <Ionicons name="add-outline" size={24} color="#10b981" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.scanButton}
              onPress={openScanModal}
            >
              <Ionicons name="scan-outline" size={24} color="#f093fb" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={handleResetTable}
            >
              <Ionicons name="refresh-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {renderError()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f093fb" />
          <Text style={styles.loadingText}>Loading your sets...</Text>
        </View>
      ) : flashCardSets.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.FlatList
          data={flashCardSets}
          keyExtractor={(item) => `set-${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderSetItem}
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

      {/* Flash Card Viewer Modal */}
      <FlashCardViewer
        visible={viewerModalVisible}
        onClose={() => setViewerModalVisible(false)}
        cards={selectedSet ? parseFlashCards(selectedSet.content) : []}
        title={selectedSet?.title || ''}
      />

      {/* Flash Card Generation Modal */}
      <FlashCardGenerationModal
        visible={generationModalVisible}
        onClose={closeGenerationModal}
        sourceContent={selectedSet?.content || ''}
        sourceTitle={selectedSet?.title || ''}
        sourceId={selectedSet?.id}
        sourceType={(selectedSet?.source_note_type as 'note' | 'scan-note') || 'note'}
        onFlashCardSaved={handleFlashCardSaved}
      />

      <Modal
        visible={scanModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeScanModal}
      >
        <SafeAreaView style={styles.modalSafeAreView}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Scan for Set</Text>
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
              {!imageUri && (
                <View style={styles.scanSection}>
                  <Text style={styles.sectionTitle}>Scan Document</Text>
                  <Text style={styles.sectionSubtitle}>
                    Take a photo or choose from gallery to extract text for set generation
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

              {extractedText && (
                <View style={styles.extractedTextSection}>
                  <Text style={styles.sectionTitle}>Extracted Text</Text>
                  <View style={styles.extractedTextContainer}>
                    <Text style={styles.extractedTextContent}>{extractedText}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {extractedText && (
              <View style={styles.generateButtonSection}>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={() => {
                    closeScanModal();
                    // Open flash card generation modal with scanned content
                    setSelectedSet({
                      id: 0,
                      title: 'Scanned Document',
                      content: extractedText,
                      card_type: 'term-definition',
                      createdAt: new Date().toISOString()
                    });
                    setGenerationModalVisible(true);
                  }}
                >
                  <Ionicons name="sparkles-outline" size={20} color="white" />
                  <Text style={styles.generateButtonText}>Generate Flash Cards</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={manualModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeManualModal}
      >
        <SafeAreaView style={styles.modalSafeAreView}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Create Manual Set</Text>
                <TouchableOpacity 
                  onPress={closeManualModal}
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
              <View style={styles.formSection}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Set Title</Text>
                  <TextInput
                    style={styles.titleInput}
                    value={manualTitle}
                    onChangeText={setManualTitle}
                    placeholder="Enter set title..."
                    placeholderTextColor="#9ca3af"
                    returnKeyType="next"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Set Content</Text>
                  <View style={styles.contentInputContainer}>
                    <TextInput
                      style={styles.contentInput}
                      value={manualContent}
                      onChangeText={setManualContent}
                      placeholder="Enter your content here..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                <View style={styles.settingGroup}>
                  <Text style={styles.settingLabel}>Card Type</Text>
                  <View style={styles.quizTypeButtons}>
                    {(['term-definition', 'question-answer'] as CardType[]).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.quizTypeButton,
                          manualCardType === type && styles.quizTypeButtonActive
                        ]}
                        onPress={() => setManualCardType(type)}
                      >
                        <Text style={[
                          styles.quizTypeButtonText,
                          manualCardType === type && styles.quizTypeButtonTextActive
                        ]}>
                          {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    isSavingManual && styles.saveButtonDisabled
                  ]}
                  onPress={saveManualSet}
                  disabled={isSavingManual}
                >
                  {isSavingManual ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <>
                      <Ionicons name="save-outline" size={20} color="white" />
                      <Text style={styles.saveButtonText}>Save Set</Text>
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
    alignItems: 'center'
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
    gap: 16,
  },
  scanButtonIcon: {
    marginBottom: 12,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  scanButtonDisabled: {
    opacity: 0.5,
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
    fontSize: 16,
  },
  contentInputContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    minHeight: 150,
  },
  contentInput: {
    padding: 16,
    fontSize: 14,
    color: '#4b5563',
    textAlignVertical: 'top',
  },
  emptyButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  manualQuizEmptyButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
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
    marginTop: 24,
    fontStyle: 'italic',
  },
});

export default FlashCardMaker;