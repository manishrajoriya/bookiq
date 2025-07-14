import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import AppendScanModal from '../components/AppendScanModal';
import EnhanceNotesModal from '../components/EnhanceNotesModal';
import FlashCardGenerationModal from '../components/FlashCardGenerationModal';
import ImageScanModal from '../components/ImageScanModal';
import NoteChatModal from '../components/NoteChatModal';
import NoteReaderModal from '../components/NoteReaderModal';
import QuizGenerationModal from '../components/QuizGenerationModal';
import { useThemeContext } from '../providers/ThemeProvider';
import { processImage } from '../services/geminiServices';
import { addHistory, addScanNote, deleteScanNote, getAllScanNotes, updateScanNote } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

const { width, height } = Dimensions.get('window');

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
  primary: '#6366f1',
  accentColor: '#6366f1',
  dangerColor: '#ff6b6b',
  successColor: '#10b981',
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
interface ScanNote {
  id: number;
  title: string;
  content: string;
  imageUri?: string;
  createdAt: Date;
  wordCount: number;
  tags?: string[];
}

interface ErrorState {
  type: 'processing' | 'saving' | 'credits' | 'network' | null;
  message: string;
  code?: string;
  retryable: boolean;
}

const StudyNotes = () => {
  const router = useRouter();
  
  // Theme context
  const { resolvedTheme } = useThemeContext();
  const COLORS = getColors(resolvedTheme === 'dark');
  
  // State management
  const [notes, setNotes] = useState<ScanNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ScanNote | null>(null);
  
  // Image scan modal state
  const [scanModalVisible, setScanModalVisible] = useState(false);
  
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
  const searchAnim = useRef(new Animated.Value(0)).current;

  // Filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [notes, searchQuery]);

  // Add state for append modal
  const [appendModalVisible, setAppendModalVisible] = useState(false);
  const [noteToAppend, setNoteToAppend] = useState<ScanNote | null>(null);

  // Quiz generation modal state
  const [quizModalVisible, setQuizModalVisible] = useState(false);

  // Flash card generation modal state
  const [flashCardModalVisible, setFlashCardModalVisible] = useState(false);

  // Flash card viewer modal state
  const [viewerModalVisible, setViewerModalVisible] = useState(false);

  // Enhance notes modal state
  const [enhanceModalVisible, setEnhanceModalVisible] = useState(false);
  const [enhanceTargetNote, setEnhanceTargetNote] = useState<ScanNote | null>(null);

  // Chat modal state
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatTargetNote, setChatTargetNote] = useState<ScanNote | null>(null);

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

  // Scan handlers for ImageScanModal
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

  const handleImageProcessed = async (extractedText: string) => {
    try {
      // Create a new note with the extracted text
      const title = extractedText.split('\n')[0].substring(0, 50) + (extractedText.split('\n')[0].length > 50 ? '...' : '');
      const noteId = await addScanNote(title, extractedText);
      
      // Add to history
      await addHistory('', 'study-notes', title, extractedText);
      
      // Refresh notes
      loadNotes();
      
      // Close modal
      closeScanModal();
      
      // Show success message
      Alert.alert(
        'Note Created',
        'Your study note has been successfully created!',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to save note:', error);
      Alert.alert('Error', 'Failed to save the note. Please try again.');
    }
  };

  const retryLastAction = () => {
    loadNotes();
  };

  const openNotePreview = (note: ScanNote) => {
    setSelectedNote(note);
    setPreviewModalVisible(true);
  };

  const handleDeleteNote = (note: ScanNote) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteScanNote(note.id);
              loadNotes();
            } catch (error) {
              console.error('Failed to delete note:', error);
              Alert.alert('Error', 'Failed to delete the note. Please try again.');
            }
          }
        }
      ]
    );
  };

  const openAppendModal = (note: ScanNote) => {
    setNoteToAppend(note);
    setAppendModalVisible(true);
  };

  const handleAppendToNote = async (newContent: string) => {
    if (!noteToAppend) return;
    
    try {
      const updatedContent = noteToAppend.content + '\n\n' + newContent;
      await updateScanNote(noteToAppend.id, noteToAppend.title, updatedContent);
      loadNotes();
      setAppendModalVisible(false);
      setNoteToAppend(null);
    } catch (error) {
      console.error('Failed to append to note:', error);
      Alert.alert('Error', 'Failed to append content to the note. Please try again.');
    }
  };

  const openQuizModal = (note: ScanNote) => {
    setSelectedNote(note);
    setQuizModalVisible(true);
  };

  const closeQuizModal = () => {
    setQuizModalVisible(false);
    setSelectedNote(null);
  };

  const handleQuizSaved = () => {
    loadNotes();
  };

  const openFlashCardModal = (note: ScanNote) => {
    setSelectedNote(note);
    setFlashCardModalVisible(true);
  };

  const closeFlashCardModal = () => {
    setFlashCardModalVisible(false);
    setSelectedNote(null);
  };

  const handleFlashCardSaved = () => {
    loadNotes();
  };

  const openFlashCardViewer = (note: ScanNote) => {
    setSelectedNote(note);
    setViewerModalVisible(true);
  };

  const closeFlashCardViewer = () => {
    setViewerModalVisible(false);
    setSelectedNote(null);
  };

  const openEnhanceModal = (note: ScanNote) => {
    setEnhanceTargetNote(note);
    setEnhanceModalVisible(true);
  };

  const closeEnhanceModal = () => {
    setEnhanceModalVisible(false);
    setEnhanceTargetNote(null);
  };

  const handleNoteEnhanced = async (enhancedContent: string) => {
    if (enhanceTargetNote) {
      await updateScanNote(enhanceTargetNote.id, enhanceTargetNote.title, enhancedContent);
      await loadNotes();
    }
    closeEnhanceModal();
  };

  const openChatModal = (note: ScanNote) => {
    setChatTargetNote(note);
    setChatModalVisible(true);
  };

  const closeChatModal = () => {
    setChatModalVisible(false);
    setChatTargetNote(null);
  };

  const handleSearchFocus = () => {
    setIsSearchFocused(true);
    Animated.timing(searchAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleSearchBlur = () => {
    setIsSearchFocused(false);
    Animated.timing(searchAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderNoteItem = ({ item }: { item: ScanNote }) => {
    const wordCount = item.wordCount;
    const hasFlashCards = item.content.includes('FRONT:') && item.content.includes('BACK:');
    
    return (
      <View
        style={[
          styles.noteCard,
          { 
            backgroundColor: COLORS.cardColor, 
            borderColor: COLORS.borderColor,
          }
        ]}
      >
        {/* Main Content Area */}
        <TouchableOpacity 
          style={styles.noteContent}
          onPress={() => openNotePreview(item)}
          activeOpacity={0.8}
        >
          {/* Header with Title and Date */}
          <View style={styles.noteHeader}>
            <View style={styles.noteTitleContainer}>
              <Text style={[styles.noteTitle, { color: COLORS.textColor.primary }]} numberOfLines={2}>
                {item.title}
              </Text>
              {hasFlashCards && (
                <View style={[styles.flashCardBadge, { backgroundColor: COLORS.successColor }]}> 
                  <Ionicons name="albums" size={12} color={COLORS.textColor.white} />
                  <Text style={[styles.badgeText, { color: COLORS.textColor.white }]}>Cards</Text>
                </View>
              )}
            </View>
            <Text style={[styles.noteDate, { color: COLORS.textColor.light }]}> 
              {formatDate(item.createdAt.toISOString())}
            </Text>
          </View>
          
          {/* Content Preview */}
          <Text style={[styles.noteExcerpt, { color: COLORS.textColor.secondary }]} numberOfLines={3}>
            {item.content}
          </Text>
          
          {/* Stats Footer */}
          <View style={styles.noteFooter}>
            <View style={styles.noteStats}>
              <View style={[styles.statItem, { backgroundColor: COLORS.backgroundColor }]}> 
                <Ionicons name="document-text" size={14} color={COLORS.accentColor} />
                <Text style={[styles.statText, { color: COLORS.textColor.secondary }]}> 
                  {wordCount} words
                </Text>
              </View>
              {item.imageUri && (
                <View style={[styles.statItem, { backgroundColor: COLORS.backgroundColor }]}>
                  <Ionicons name="image" size={14} color={COLORS.accentColor} />
                  <Text style={[styles.statText, { color: COLORS.textColor.secondary }]}>
                    Has Image
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        {/* Action Buttons */}
        <View style={styles.noteActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
            onPress={() => openQuizModal(item)}
          >
            <Ionicons name="help-circle" size={20} color={COLORS.accentColor} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
            onPress={() => openFlashCardModal(item)}
          >
            <Ionicons name="albums" size={20} color={COLORS.successColor} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
            onPress={() => openChatModal(item)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
            onPress={() => openEnhanceModal(item)}
          >
            <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          
          {hasFlashCards && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: COLORS.successColor }]}
              onPress={() => openFlashCardViewer(item)}
            >
              <Ionicons name="play" size={20} color={COLORS.textColor.white} />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
            onPress={() => handleDeleteNote(item)}
          >
            <Ionicons name="trash" size={20} color={COLORS.dangerColor} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconContainer, { backgroundColor: COLORS.backgroundColor }]}>
        <Ionicons name="document-text-outline" size={64} color={COLORS.accentColor} />
      </View>
      <Text style={[styles.emptyTitle, { color: COLORS.textColor.primary }]}>
        {searchQuery ? "No notes found" : "No study notes yet"}
      </Text>
      <Text style={[styles.emptySubtitle, { color: COLORS.textColor.secondary }]}>
        {searchQuery 
          ? "Try adjusting your search terms"
          : "Start by scanning documents to create your first study note"
        }
      </Text>
      {!searchQuery && (
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: COLORS.accentColor }]}
          onPress={openScanModal}
        >
          <Ionicons name="scan-outline" size={20} color={COLORS.textColor.white} />
          <Text style={[styles.createButtonText, { color: COLORS.textColor.white }]}>
            Scan Document
          </Text>
        </TouchableOpacity>
      )}
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
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.headerBackground, borderBottomColor: COLORS.borderColor }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: COLORS.textColor.primary }]}>Study Notes</Text>
            <Text style={[styles.headerSubtitle, { color: COLORS.textColor.secondary }]}>
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: COLORS.accentColor }]}
            onPress={openScanModal}
          >
            <Ionicons name="add" size={24} color={COLORS.textColor.white} />
          </TouchableOpacity>
        </View>
        
        {/* Search Bar */}
        <Animated.View 
          style={[
            styles.searchContainer, 
            { 
              backgroundColor: COLORS.cardColor,
              borderColor: isSearchFocused ? COLORS.accentColor : COLORS.borderColor,
              transform: [{
                scale: searchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.02],
                })
              }]
            }
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={COLORS.textColor.secondary}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: COLORS.textColor.primary }]}
            placeholder="Search study notes..."
            placeholderTextColor={COLORS.textColor.light}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={COLORS.textColor.secondary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* Error Banner */}
      {renderError()}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentColor} />
          <Text style={[styles.loadingText, { color: COLORS.accentColor }]}>Loading your notes...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotes}
          renderItem={renderNoteItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState()}
        />
      )}



      {/* Image Scan Modal */}
      <ImageScanModal
        visible={scanModalVisible}
        onClose={closeScanModal}
        onImageProcessed={handleImageProcessed}
        title="Create Study Note"
        subtitle="Take a photo or choose from gallery to extract text for your study note"
        actionButtonText="Create Note"
        actionButtonIcon="document-text-outline"
        accentColor={COLORS.accentColor}
        onProcessImage={processScannedImage}
        showExtractedText={true}
        showActionButton={true}
      />

      {/* Note Preview Modal */}
      <NoteReaderModal
        visible={previewModalVisible}
        onClose={() => setPreviewModalVisible(false)}
        note={selectedNote}
        isScanNote={true}
      />

      {/* Append Scan Modal */}
      <AppendScanModal
        visible={appendModalVisible}
        onClose={() => setAppendModalVisible(false)}
        onAppend={handleAppendToNote}
        existingContent={noteToAppend?.content || ''}
        noteTitle={noteToAppend?.title || ''}
      />

      {/* Quiz Generation Modal */}
      <QuizGenerationModal
        visible={quizModalVisible}
        onClose={closeQuizModal}
        sourceContent={selectedNote?.content || ''}
        sourceTitle={selectedNote?.title || ''}
        sourceId={selectedNote?.id}
        sourceType="scan-note"
        onQuizSaved={handleQuizSaved}
      />

      {/* Flash Card Generation Modal */}
      <FlashCardGenerationModal
        visible={flashCardModalVisible}
        onClose={closeFlashCardModal}
        sourceContent={selectedNote?.content || ''}
        sourceTitle={selectedNote?.title || ''}
        sourceId={selectedNote?.id}
        sourceType="scan-note"
        onFlashCardSaved={handleFlashCardSaved}
      />

      {/* Enhance Notes Modal */}
      <EnhanceNotesModal
        visible={enhanceModalVisible}
        onClose={closeEnhanceModal}
        sourceContent={enhanceTargetNote?.content || ''}
        sourceTitle={enhanceTargetNote?.title || ''}
        sourceId={enhanceTargetNote?.id}
        onNoteEnhanced={handleNoteEnhanced}
      />

      {/* Note Chat Modal */}
      <NoteChatModal
        visible={chatModalVisible}
        onClose={closeChatModal}
        noteTitle={chatTargetNote?.title || ''}
        noteContent={chatTargetNote?.content || ''}
        accentColor={COLORS.accentColor}
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
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    padding: 20,
    paddingBottom: 100,
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
  emptyContainer: {
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
    fontSize: 22,
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },

  noteContent: {
    padding: 20,
    paddingBottom: 16,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
    lineHeight: 24,
  },
  flashCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  noteDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  noteExcerpt: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    marginTop: 8,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  imageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fabContainer: {
    position: 'absolute',
    right: 24,
    bottom: 24,
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
    backgroundColor: '#ef4444',
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
  modalSafeAreView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
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
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  scanButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  scanButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
  },
  imageSection: {
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
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
    lineHeight: 20,
  },
  extractedTextNote: {
    fontSize: 12,
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
    marginBottom: 8,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  contentInputContainer: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 120,
  },
  contentInput: {
    padding: 16,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  saveSection: {
    padding: 20,
    borderTopWidth: 1,
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
  },
  pickerOptionText: {
    fontSize: 16,
    marginLeft: 16,
  },
  pickerCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pickerCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noteActions: {
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
  flashCardButton: {
    padding: 4,
    marginLeft: 8,
  },
  chatButton: {
    padding: 4,
    marginLeft: 8,
  },
  practiceButton: {
    padding: 4,
    marginLeft: 8,
    borderRadius: 8,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default StudyNotes;