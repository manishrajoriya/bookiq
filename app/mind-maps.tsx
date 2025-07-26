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
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from 'react-native';
import ImageScanModal from '../components/ImageScanModal';
import MindMapViewer from '../components/MindMapViewer';
import { generateMindMapFromNotes } from '../services/geminiServices';
import { addMindMap, getAllMindMaps, updateMindMap } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

const { width, height } = Dimensions.get('window');

const getColors = (isDark: boolean) => ({
  primary: '#96ceb4',
  accentColor: '#96ceb4',
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

interface MindMap {
  id: number;
  title: string;
  content: string;
  source_note_id?: number;
  source_note_type?: string;
  createdAt: string;
}

interface ErrorState {
  type: 'generating' | 'credits' | 'network' | null;
  message: string;
  retryable: boolean;
}

const MindMaps = () => {
  const router = useRouter();
  const [mindMaps, setMindMaps] = useState<MindMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMindMap, setSelectedMindMap] = useState<MindMap | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [generationModalVisible, setGenerationModalVisible] = useState(false);
  const [inputContent, setInputContent] = useState('');
  const [generatedMindMap, setGeneratedMindMap] = useState(''); // Store raw AI response
  const [generatedMindMapRaw, setGeneratedMindMapRaw] = useState(''); // Store raw AI response
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<ErrorState>({ type: null, message: '', retryable: false });
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  // Use a boolean for dark mode (replace with your theme logic if needed)
  const isDark = false; // Set to true if you want dark mode
  const COLORS = getColors(isDark);
  const [editMode, setEditMode] = useState(false);
  const [editMap, setEditMap] = useState<any>(null);
  const [editRawMode, setEditRawMode] = useState(false);
  const [rawEditValue, setRawEditValue] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scannedText, setScannedText] = useState('');

  const handleError = (type: ErrorState['type'], message: string, retryable: boolean = true) => {
    setError({ type, message, retryable });
    if (Platform.OS !== 'web') {
      Vibration.vibrate(100);
    }
  };
  const clearError = () => setError({ type: null, message: '', retryable: false });

  const loadMindMaps = useCallback(async () => {
    try {
      setLoading(true);
      clearError();
      const data = await getAllMindMaps();
      console.log(' Loaded mind maps:', data);
      
      setMindMaps(data);
    } catch (error) {
      handleError('network', 'Failed to load mind maps. Please check your connection and try again.', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMindMaps();
    }, [loadMindMaps])
  );

  const openGenerationModal = () => {
    setInputContent('');
    setGeneratedMindMap('');
    setGenerationModalVisible(true);
  };
  const closeGenerationModal = () => {
    setGenerationModalVisible(false);
    setInputContent('');
    setGeneratedMindMap('');
    clearError();
  };

  const generateMindMap = async () => {
    if (!inputContent.trim()) {
      handleError('generating', 'Please enter a topic or content to generate a mind map.', false);
      return;
    }
    try {
      setIsGenerating(true);
      clearError();
      const creditResult = await subscriptionService.spendCredits(2);
      if (!creditResult.success) {
        Alert.alert(
          'Out of Credits',
          creditResult.error || 'You need at least 2 credits to generate a mind map.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Get Credits', onPress: () => router.push('/paywall') }
          ]
        );
        setIsGenerating(false);
        return;
      }
      // Get raw AI response
      // Pass mode: topic if not from scan, notes if from scan
      const mode = scannedText ? 'notes' : 'topic';
      const mindMapRaw = await generateMindMapFromNotes(inputContent, mode);
      let rawToStore = '';
      if (typeof mindMapRaw === 'object') {
        rawToStore = JSON.stringify(mindMapRaw);
      } else {
        rawToStore = String(mindMapRaw);
      }
      setGeneratedMindMapRaw(rawToStore);
      setGeneratedMindMap(rawToStore);
    } catch (error) {
      handleError('generating', 'Failed to generate mind map. Please try again.', true);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveMindMap = async () => {
    if (!generatedMindMapRaw) return;
    try {
      const title = inputContent.split('\n')[0].substring(0, 50) + (inputContent.split('\n')[0].length > 50 ? '...' : '');
      await addMindMap(title, generatedMindMapRaw);
      Alert.alert('Success!', 'Mind map has been saved successfully.', [{ text: 'OK' }]);
      loadMindMaps();
      closeGenerationModal();
    } catch (error) {
      handleError('generating', 'Failed to save mind map. Please try again.', true);
    }
  };

  const openPreview = (mindMap: MindMap) => {
    setSelectedMindMap(mindMap);
    setPreviewModalVisible(true);
  };

  const closePreview = () => {
    setPreviewModalVisible(false);
    setSelectedMindMap(null);
  };

  const handleEditSave = async () => {
    if (selectedMindMap && editMap) {
      // Save the edited raw content (stringify if object)
      let rawToStore = '';
      if (typeof editMap === 'object') {
        rawToStore = JSON.stringify(editMap);
      } else {
        rawToStore = String(editMap);
      }
      await updateMindMap(selectedMindMap.id, selectedMindMap.title, rawToStore);
      setSelectedMindMap({ ...selectedMindMap, content: rawToStore });
      setEditMode(false);
      setEditMap(null);
      loadMindMaps();
    }
  };

  const handleRawEditSave = async () => {
    if (selectedMindMap) {
      await updateMindMap(selectedMindMap.id, selectedMindMap.title, rawEditValue);
      setSelectedMindMap({ ...selectedMindMap, content: rawEditValue });
      setEditRawMode(false);
      setRawEditValue('');
      loadMindMaps();
    }
  };

  // Helper to parse mind map JSON or outline from raw content
  const getParsedMindMap = (mindMap: MindMap | null) => {
    if (!mindMap) return null;
    try {
      // Try JSON parse first
      return typeof mindMap.content === 'string' ? JSON.parse(mindMap.content) : mindMap.content;
    } catch {
      // Fallback: parse as outline
      const lines = mindMap.content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return null;
      const root = lines[0];
      const nodes = lines.slice(1).map(line => {
        const match = line.match(/^[-*•\d+\.\)]\s*(.+)$/);
        return { label: match ? match[1] : line };
      });
      return { root, nodes };
    }
  };

  const renderMindMapItem = ({ item }: { item: MindMap }) => (
    <View style={[styles.card, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}> 
      <TouchableOpacity onPress={() => openPreview(item)} style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: COLORS.textColor.primary }]} numberOfLines={2}>{item.title || 'Untitled Mind Map'}</Text>
        <Text style={[styles.cardText, { color: COLORS.textColor.secondary }]} numberOfLines={3}>{item.content.length > 100 ? item.content.substring(0, 100) + '...' : item.content}</Text>
        <Text style={[styles.cardDate, { color: COLORS.textColor.light }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="git-network-outline" size={80} color={COLORS.accentColor} style={{ marginBottom: 24 }} />
      <Text style={[styles.emptyTitle, { color: COLORS.textColor.primary }]}>No Mind Maps Yet</Text>
      <Text style={[styles.emptySubtitle, { color: COLORS.textColor.secondary }]}>Generate mind maps from your notes or topics to visualize concepts and ideas.</Text>
      <TouchableOpacity style={[styles.emptyButton, { backgroundColor: COLORS.accentColor }]} onPress={openGenerationModal}>
        <Ionicons name="add" size={20} color={COLORS.textColor.white} />
        <Text style={[styles.emptyButtonText, { color: COLORS.textColor.white }]}>Create Mind Map</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => {
    if (!error.type) return null;
    return (
      <View style={[styles.errorBanner, { backgroundColor: COLORS.backgroundColor, borderBottomColor: COLORS.borderColor }]}> 
        <View style={styles.errorContent}>
          <Ionicons name="alert-circle" size={20} color="#ff6b6b" />
          <Text style={[styles.errorMessage, { color: '#ff6b6b' }]}>{error.message}</Text>
        </View>
        {error.retryable && (
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: '#ff6b6b' }]} onPress={loadMindMaps}>
            <Text style={[styles.retryButtonText, { color: COLORS.textColor.white }]}>Retry</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.dismissButton} onPress={clearError}>
          <Ionicons name="close" size={16} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    );
  };

  const openScanModal = () => {
    setScanModalVisible(true);
  };
  const closeScanModal = () => {
    setScanModalVisible(false);
  };
  const handleImageProcessed = (extractedText: string) => {
    setScanModalVisible(false);
    setScannedText(extractedText);
    setInputContent(extractedText);
    setGenerationModalVisible(true);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.backgroundColor }]}> 
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.headerBackground} />
      <View style={[styles.header, { backgroundColor: COLORS.headerBackground, borderBottomColor: COLORS.borderColor }]}> 
        <Text style={[styles.headerTitle, { color: COLORS.textColor.primary }]}>Mind Maps</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={[styles.headerButton, { backgroundColor: COLORS.backgroundColor }]} onPress={openGenerationModal}>
            <Ionicons name="add" size={24} color={COLORS.accentColor} />
            <Text style={{ color: COLORS.accentColor, fontWeight: 'bold', marginLeft: 6 }}>From Topic</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerButton, { backgroundColor: COLORS.backgroundColor }]} onPress={openScanModal}>
            <Ionicons name="scan" size={24} color={COLORS.accentColor} />
            <Text style={{ color: COLORS.accentColor, fontWeight: 'bold', marginLeft: 6 }}>From Notes/Image</Text>
          </TouchableOpacity>
        </View>
      </View>
      {renderError()}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accentColor} />
          <Text style={[styles.loadingText, { color: COLORS.accentColor }]}>Loading your mind maps...</Text>
        </View>
      ) : mindMaps.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.FlatList
          data={mindMaps}
          keyExtractor={(item) => `mindmap-${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderMindMapItem}
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
      {/* Mind Map Generation Modal */}
      {generationModalVisible && (
        <View style={styles.generationModalOverlay}>
          <View style={styles.generationModalContainer}>
            <Text style={styles.generationModalTitle}>Generate Mind Map</Text>
            <Text style={styles.generationModalSubtitle}>Enter a topic, concept, or paste your notes to generate a mind map outline.</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Topic or Content</Text>
              <Animated.View style={{ opacity: isGenerating ? 0.5 : 1 }}>
                <TextInput
                  style={styles.input}
                  value={inputContent}
                  onChangeText={setInputContent}
                  placeholder="E.g. Photosynthesis, World War II, Newton's Laws, etc."
                  placeholderTextColor="#aaa"
                  editable={!isGenerating}
                  multiline
                  numberOfLines={4}
                />
              </Animated.View>
            </View>
            {generatedMindMap && (
              <View style={styles.generatedMindMapContainer}>
                <Text style={styles.generatedMindMapLabel}>Generated Mind Map Outline</Text>
                <View style={styles.generatedMindMapBox}>
                  <ScrollView style={{ maxHeight: 200 }}>
                    <Text style={styles.generatedMindMapText}>{generatedMindMap}</Text>
                  </ScrollView>
                </View>
                <TouchableOpacity style={styles.saveButton} onPress={saveMindMap}>
                  <Ionicons name="save-outline" size={20} color="white" />
                  <Text style={styles.saveButtonText}>Save Mind Map</Text>
                </TouchableOpacity>
              </View>
            )}
            {!generatedMindMap && (
              <TouchableOpacity style={styles.generateButton} onPress={generateMindMap} disabled={isGenerating}>
                {isGenerating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="git-network-outline" size={20} color="white" />
                    <Text style={styles.generateButtonText}>Generate Mind Map</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeModalButton} onPress={closeGenerationModal}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Mind Map Preview Modal */}
      {previewModalVisible && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 0, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 24, marginBottom: 12 }}>{selectedMindMap?.title}</Text>
            <View style={{ flexDirection: 'row', marginBottom: 12 }}>
              {getParsedMindMap(selectedMindMap) && !editRawMode && (
                <TouchableOpacity
                  style={{ backgroundColor: editMode ? '#43e97b' : '#96ceb4', padding: 8, borderRadius: 8, marginRight: 8 }}
                  onPress={() => {
                    setEditMode(!editMode);
                    setEditMap(getParsedMindMap(selectedMindMap));
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{editMode ? 'Cancel' : 'Edit'}</Text>
                </TouchableOpacity>
              )}
              {!editRawMode && (
                <TouchableOpacity
                  style={{ backgroundColor: '#f7b731', padding: 8, borderRadius: 8, marginRight: 8 }}
                  onPress={() => {
                    setEditRawMode(true);
                    setRawEditValue(selectedMindMap?.content || '');
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Edit Raw</Text>
                </TouchableOpacity>
              )}
              {editMode && !editRawMode && (
                <TouchableOpacity
                  style={{ backgroundColor: '#43e97b', padding: 8, borderRadius: 8 }}
                  onPress={handleEditSave}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
                </TouchableOpacity>
              )}
              {editRawMode && (
                <TouchableOpacity
                  style={{ backgroundColor: '#43e97b', padding: 8, borderRadius: 8 }}
                  onPress={handleRawEditSave}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save Raw</Text>
                </TouchableOpacity>
              )}
              {editRawMode && (
                <TouchableOpacity
                  style={{ backgroundColor: '#ff6b6b', padding: 8, borderRadius: 8, marginLeft: 8 }}
                  onPress={() => { setEditRawMode(false); setRawEditValue(''); }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
            {editRawMode ? (
              <View style={{ width: '100%', paddingHorizontal: 20 }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Edit Raw Mind Map Content</Text>
                <TextInput
                  value={rawEditValue}
                  onChangeText={setRawEditValue}
                  style={{ borderWidth: 1, borderColor: '#96ceb4', borderRadius: 8, minHeight: 120, padding: 10, fontSize: 14, color: '#374151', textAlignVertical: 'top' }}
                  multiline
                  autoFocus
                />
              </View>
            ) : (() => {
              const parsed = editMode ? editMap : getParsedMindMap(selectedMindMap);
              if (parsed && parsed.root && parsed.nodes) {
                return (
                  <ScrollView
                    style={{ flex: 1, width: '100%' }}
                    contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
                    horizontal={false}
                    bounces={true}
                  >
                    <MindMapViewer
                      mindMap={parsed}
                      editable={editMode}
                      onChange={setEditMap}
                      fullScreen={true}
                      onCloseFullScreen={closePreview}
                    />
                  </ScrollView>
                );
              } else {
                return <Text style={{ color: '#374151', fontSize: 15 }}>Invalid mind map data</Text>;
              }
            })()}
          </View>
        </View>
      )}
      {/* Image Scan Modal for Mind Map Generation */}
      <ImageScanModal
        visible={scanModalVisible}
        onClose={closeScanModal}
        onImageProcessed={handleImageProcessed}
        title="Scan for Mind Map"
        subtitle="Take a photo or choose from gallery to extract notes for mind map generation"
        actionButtonText="Generate Mind Map"
        actionButtonIcon="git-network-outline"
        accentColor={COLORS.accentColor}
        showExtractedText={true}
        showActionButton={true}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 16, fontSize: 16, fontWeight: '500' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 24, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32, maxWidth: 300 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 8 },
  emptyButtonText: { fontSize: 16, fontWeight: '600' },
  listContent: { padding: 20 },
  card: {
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
  cardContent: { padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', flex: 1, lineHeight: 24 },
  cardText: { fontSize: 15, lineHeight: 22, marginBottom: 16, marginTop: 8 },
  cardDate: { fontSize: 12, fontWeight: '500' },
  errorBanner: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  errorContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  errorMessage: { fontSize: 14, marginLeft: 8, flex: 1 },
  retryButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  retryButtonText: { fontSize: 12, fontWeight: '600' },
  dismissButton: { padding: 4, marginLeft: 8 },
  generationModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  generationModalContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '90%', maxWidth: 420, alignItems: 'stretch', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  generationModalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  generationModalSubtitle: { fontSize: 15, color: '#888', marginBottom: 20, textAlign: 'center' },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, fontSize: 15, color: '#1a1a1a', minHeight: 60, textAlignVertical: 'top' },
  generateButton: { backgroundColor: '#96ceb4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, marginTop: 16 },
  generateButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  generatedMindMapContainer: { marginTop: 20 },
  generatedMindMapLabel: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  generatedMindMapBox: { backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, marginBottom: 12 },
  generatedMindMapText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  saveButton: { backgroundColor: '#96ceb4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, marginTop: 8 },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  closeModalButton: { position: 'absolute', top: 12, right: 12, padding: 4 },
});

export default MindMaps;