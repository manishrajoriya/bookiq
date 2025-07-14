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
import FlashCardGenerationModal from '../components/FlashCardGenerationModal';
import FlashCardViewer from '../components/FlashCardViewer';
import ImageScanModal from '../components/ImageScanModal';
import ManualFlashCardModal from '../components/ManualFlashCardModal';
import NoteReaderModal from '../components/NoteReaderModal';
import { useThemeContext } from '../providers/ThemeProvider';
import { processImage } from '../services/geminiServices';
import { FlashCardSet, getAllFlashCardSets } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

const { width, height } = Dimensions.get('window');

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
  primary: '#43e97a',
  secondary: '#43e97b',
  accentColor: '#43e97b',
  dangerColor: '#ff6b6b',
  backgroundColor: isDark ? '#0f0f0f' : '#f9fafb',
  cardColor: isDark ? '#1a1a1a' : '#ffffff',
  headerBackground: isDark ? '#1a1a1a' : '#ffffff',
  borderColor: isDark ? '#333333' : '#f3f4f6',
  iconColor: isDark ? '#9BA1A6' : '#888',
  textColor: {
    primary: isDark ? '#ffffff' : '#111827',
    secondary: isDark ? '#cccccc' : '#6b7280',
    light: isDark ? '#999999' : '#9ca3af',
    white: '#ffffff',
  },
});

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

const FlashCardMaker = () => {
  const router = useRouter();
  
  // Theme context
  const { resolvedTheme } = useThemeContext();
  const COLORS = getColors(resolvedTheme === 'dark');
  
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
  
  // Manual creation state
  const [manualModalVisible, setManualModalVisible] = useState(false);
  
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
  };

  const closeScanModal = () => {
    setScanModalVisible(false);
  };

  const processScannedImage = async (uri: string): Promise<string> => {
    try {
      const creditResult = await subscriptionService.spendCredits(1);
      const hasEnoughCredits = creditResult.success;
      if (!hasEnoughCredits) {
        Alert.alert(
          "Out of Credits",
          "You need at least 1 credit to scan an image.",
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
    // Open flash card generation modal with scanned content
    setSelectedSet({
      id: 0,
      title: 'Scanned Document',
      content: extractedText,
      card_type: 'term-definition',
      createdAt: new Date().toISOString()
    });
    setGenerationModalVisible(true);
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
    setManualModalVisible(true);
  };

  const closeManualModal = () => {
    setManualModalVisible(false);
  };

  const handleManualFlashCardSaved = () => {
    loadFlashCardSets();
  };



  const openPreview = (set: FlashCardSet) => {
    setSelectedSet(set);
    setPreviewModalVisible(true);
  };

  const openEditNote = (set: FlashCardSet) => {
    router.push(`/note/${set.id}` as any);
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
        // Retry is handled by the ImageScanModal component
        break;
      case 'network':
        loadFlashCardSets();
        break;
      default:
        clearError();
    }
  };

  const renderSetItem = ({ item }: { item: FlashCardSet }) => (
    <View style={[styles.noteCard, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}>
      {/* Main Content Area */}
      <TouchableOpacity 
        onPress={() => openPreview(item)}
        activeOpacity={0.8}
        style={styles.noteContent}
      >
        {/* Header with Title and Date */}
        <View style={styles.noteHeader}>
          <View style={styles.noteTitleContainer}>
            <Text style={[styles.noteTitle, { color: COLORS.textColor.primary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={[styles.flashCardBadge, { backgroundColor: COLORS.accentColor }]}>
              <Ionicons name="albums" size={12} color={COLORS.textColor.white} />
              <Text style={[styles.badgeText, { color: COLORS.textColor.white }]}>Cards</Text>
            </View>
          </View>
          <Text style={[styles.noteDate, { color: COLORS.textColor.light }]}>
            {item.createdAt}
          </Text>
        </View>
        
        {/* Content Preview */}
        <Text 
          numberOfLines={3} 
          style={[styles.noteContent, { color: COLORS.textColor.secondary }]}
        >
          {item.content}
        </Text>
        
        {/* Stats Footer */}
        <View style={styles.noteFooter}>
          <View style={styles.noteStats}>
            <View style={[styles.statItem, { backgroundColor: COLORS.backgroundColor }]}>
              <Ionicons name="document-text" size={14} color={COLORS.accentColor} />
              <Text style={[styles.statText, { color: COLORS.textColor.secondary }]}>
                {item.card_type.replace('-', ' ')}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Action Buttons */}
      <View style={styles.noteActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: COLORS.accentColor }]}
          onPress={() => openFlashCardViewer(item)}
        >
          <Ionicons name="play" size={20} color={COLORS.textColor.white} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
          onPress={() => openEditNote(item)}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.accentColor} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
          onPress={() => openGenerationModal(item)}
        >
          <Ionicons name="copy-outline" size={20} color={COLORS.accentColor} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Animated.View
        style={[
          styles.emptyIconContainer,
          { backgroundColor: COLORS.backgroundColor, transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Ionicons name="copy-outline" size={80} color={COLORS.accentColor} />
      </Animated.View>
      <Text style={[styles.emptyTitle, { color: COLORS.textColor.primary }]}>No Flash Card Sets</Text>
      <Text style={[styles.emptySubtitle, { color: COLORS.textColor.secondary }]}>
        Generate sets from your notes, scan documents, or create them manually
      </Text>
      <View style={styles.emptyButtons}>
        <TouchableOpacity 
          style={[styles.manualQuizEmptyButton, { backgroundColor: COLORS.accentColor }]}
          onPress={openManualModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add-outline" size={20} color={COLORS.textColor.white} />
          <Text style={[styles.manualQuizEmptyButtonText, { color: COLORS.textColor.white }]}>Create Set</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.scanEmptyButton, { backgroundColor: COLORS.accentColor }]}
          onPress={openScanModal}
          activeOpacity={0.8}
        >
          <Ionicons name="scan-outline" size={20} color={COLORS.textColor.white} />
          <Text style={[styles.scanEmptyButtonText, { color: COLORS.textColor.white }]}>Scan Document</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.emptyNote, { color: COLORS.textColor.secondary }]}>
        💡 If you're experiencing database issues, try the red reset button in the header
      </Text>
    </View>
  );

  const renderError = () => {
    if (!error.type) return null;
    
    return (
      <View style={[styles.errorBanner, { backgroundColor: COLORS.backgroundColor, borderBottomColor: COLORS.borderColor }]}>
        <View style={styles.errorContent}>
          <Ionicons 
            name="alert-circle-outline" 
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
      
      <Animated.View style={[
        styles.header,
        { backgroundColor: COLORS.headerBackground, borderBottomColor: COLORS.borderColor },
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
            <Text style={[styles.headerTitle, { color: COLORS.textColor.primary }]}>Flash Card Maker</Text>
            <Text style={[styles.headerSubtitle, { color: COLORS.textColor.secondary }]}>
              {flashCardSets.length} saved {flashCardSets.length === 1 ? 'set' : 'sets'}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.manualQuizButton}
              onPress={openManualModal}
            >
              <Ionicons name="add-outline" size={24} color={COLORS.accentColor} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.manualQuizButton}
              onPress={openScanModal}
            >
              <Ionicons name="scan-outline" size={24} color={COLORS.accentColor} />
            </TouchableOpacity>
            
          </View>
        </View>
      </Animated.View>

      {renderError()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentColor} />
          <Text style={[styles.loadingText, { color: COLORS.accentColor }]}>Loading your sets...</Text>
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

      {/* Note Reader Modal for Preview and Edit */}
      <NoteReaderModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        note={selectedSet}
        isScanNote={false}
        isQuiz={false}
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

      {/* Image Scan Modal */}
      <ImageScanModal
        visible={scanModalVisible}
        onClose={closeScanModal}
        onImageProcessed={handleImageProcessed}
        title="Scan for Set"
        subtitle="Take a photo or choose from gallery to extract text for set generation"
        actionButtonText="Generate Flash Cards"
        actionButtonIcon="sparkles-outline"
        accentColor={COLORS.accentColor}
        onProcessImage={processScannedImage}
        showExtractedText={true}
        showActionButton={true}
      />

      {/* Manual Flash Card Modal */}
      <ManualFlashCardModal
        visible={manualModalVisible}
        onClose={closeManualModal}
        onFlashCardSaved={handleManualFlashCardSaved}
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
  noteCard: {
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
  noteContent: {
    padding: 20,
    paddingBottom: 16,
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  practiceButton: {
    padding: 4,
    marginLeft: 8,
  },
  editButton: {
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
  noteTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flashCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  noteStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
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
});

export default FlashCardMaker;