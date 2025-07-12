import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { getAnswerFromGemini, processImage } from '../services/geminiServices';
import { addHistory, getAllHistory, spendCredits, updateHistoryAnswer } from '../services/historyStorage';

const { width, height } = Dimensions.get('window');

const getColors = (isDark: boolean) => ({
  primary: '#667eea',
  accentColor: '#667eea',
  dangerColor: '#ff6b6b',
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

interface ScanHistoryItem {
  id: number;
  imageUri: string;
  extractedText: string;
  aiAnswer: string;
  createdAt: string;
}

const AIScan = () => {
  const router = useRouter();
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [pendingHistoryId, setPendingHistoryId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Theme
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');

  // Load scan history from history table, filter for 'ai-scan'
  const loadScanHistory = useCallback(async () => {
    setLoading(true);
    try {
      const allHistory = await getAllHistory();
      const aiScanHistory = allHistory.filter((item: any) => item.feature === 'ai-scan');
      setScanHistory(aiScanHistory);
    } catch (e) {
      setScanHistory([]);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    loadScanHistory();
  }, [loadScanHistory]);

  // Image picker logic
  const handleScan = async () => {
    setPickerModalVisible(false);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Camera permission is required to scan images!');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets) {
      setImageUri(result.assets[0].uri);
      setModalVisible(true);
      await processSelectedImage(result.assets[0].uri);
    }
  };

  const handleGallery = async () => {
    setPickerModalVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets) {
      setImageUri(result.assets[0].uri);
      setModalVisible(true);
      await processSelectedImage(result.assets[0].uri);
    }
  };

  const processSelectedImage = async (uri: string) => {
    setIsLoading(true);
    setError(null);
    setAiAnswer(null);
    setExtractedText(null);
    setPendingHistoryId(null);
    try {
      setLoadingMessage('Scanning image...');
      const hasEnoughCredits = await spendCredits(1);
      if (!hasEnoughCredits) {
        Alert.alert(
          'Out of Credits',
          'You need at least 1 credit to scan an image.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Get Credits', onPress: () => router.push('/paywall') },
          ]
        );
        setIsLoading(false);
        return;
      }
      const text = await processImage(uri);
      setExtractedText(text);
      // Save to history
      const newHistoryId = await addHistory(uri, 'ai-scan', text, '');
      setPendingHistoryId(newHistoryId);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const getAIAnswer = async () => {
    if (!extractedText || !imageUri || !pendingHistoryId) {
      setError('Cannot get answer. Missing text, image, or history context.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      setLoadingMessage('Generating answer... (1 credit)');
      const hasEnoughCredits = await spendCredits(1);
      if (!hasEnoughCredits) {
        Alert.alert(
          'Out of Credits',
          'You need at least 1 credit to get an answer.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Get Credits', onPress: () => router.push('/paywall') },
          ]
        );
        setIsLoading(false);
        return;
      }
      const answer = await getAnswerFromGemini(extractedText, 'ai-scan');
      setAiAnswer(answer);
      await updateHistoryAnswer(pendingHistoryId, answer);
      // Refresh history after answer
      loadScanHistory();
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setImageUri(null);
    setError(null);
    setAiAnswer(null);
    setExtractedText(null);
    setPendingHistoryId(null);
  };

  // Card expand/collapse
  const handleToggleExpand = (id: number) => {
    setExpandedId(current => (current === id ? null : id));
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>  
      <StatusBar barStyle={backgroundColor === '#fff' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}> 
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: textColor }]}>AI Scan</Text>
          <Text style={[styles.headerSubtitle, { color: iconColor }]}>Scan documents and get instant AI answers</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.headerButton, { backgroundColor: cardColor }]} 
            onPress={() => setPickerModalVisible(true)}
          >
            <Ionicons name="scan" size={24} color={iconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content: Scan History List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={iconColor} />
          <Text style={[styles.loadingText, { color: iconColor }]}>Loading your scans...</Text>
        </View>
      ) : (
        <FlatList
          data={scanHistory}
          keyExtractor={item => `scan-${item.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={[styles.scanCard, { backgroundColor: cardColor, borderColor }]}> 
              <TouchableOpacity onPress={() => handleToggleExpand(item.id)} activeOpacity={0.95}>
                <View style={styles.cardHeader}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.cardImage} />
                  ) : (
                    <View style={[styles.imagePlaceholder, { backgroundColor: '#eee', borderColor: borderColor }]}> 
                      <Ionicons name="image" size={24} color={iconColor} />
                    </View>
                  )}
                  <View style={styles.cardContent}>
                    <View style={styles.cardMeta}>
                      <View style={[styles.featureBadge, { backgroundColor: '#667eea' }]}> 
                        <Text style={styles.featureBadgeText}>AI Scan</Text>
                      </View>
                      <Text style={[styles.timestamp, { color: iconColor }]}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <Text numberOfLines={expandedId === item.id ? undefined : 2} style={[styles.cardText, { color: textColor }]}> 
                      {item.aiAnswer ? item.aiAnswer : item.extractedText}
                    </Text>
                  </View>
                  <Ionicons name={expandedId === item.id ? 'chevron-up' : 'chevron-down'} size={20} color={iconColor} style={styles.expandIcon} />
                </View>
                {expandedId === item.id && (
                  <View style={[styles.expandedContent, { borderTopColor: borderColor }]}> 
                    <View style={[styles.expandedSection, { backgroundColor: '#f3f4f6' }]}> 
                      <Text style={[styles.expandedLabel, { color: '#667eea' }]}>Extracted Text:</Text>
                      <ScrollView style={styles.expandedScrollView} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.expandedText, { color: iconColor }]}>{item.extractedText}</Text>
                      </ScrollView>
                      {item.aiAnswer ? (
                        <>
                          <Text style={[styles.expandedLabel, { color: '#22c55e', marginTop: 12 }]}>AI Answer:</Text>
                          <ScrollView style={styles.expandedScrollView} showsVerticalScrollIndicator={false}>
                            <Text style={[styles.expandedText, { color: textColor }]}>{item.aiAnswer}</Text>
                          </ScrollView>
                        </>
                      ) : null}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="scan" size={80} color={iconColor} style={{ marginBottom: 24 }} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No Scans Yet</Text>
              <Text style={[styles.emptySubtitle, { color: iconColor }]}>Start by scanning a document or image to get AI-powered answers.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: iconColor }]} 
          onPress={() => setPickerModalVisible(true)}
        >
          <Ionicons name="scan" size={24} color={backgroundColor} />
        </TouchableOpacity>
      </View>

      {/* Picker Modal for image source selection */}
      <Modal
        transparent
        animationType="fade"
        visible={pickerModalVisible}
        onRequestClose={() => setPickerModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.pickerModalOverlay}
          activeOpacity={1}
          onPress={() => setPickerModalVisible(false)}
        >
          <View style={styles.pickerModalContainer}>
            <TouchableOpacity 
              style={styles.pickerOption} 
              onPress={handleScan}
            >
              <Ionicons name="camera-outline" size={24} color="#6366f1" />
              <Text style={styles.pickerOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.pickerOption} 
              onPress={handleGallery}
            >
              <Ionicons name="image-outline" size={24} color="#6366f1" />
              <Text style={styles.pickerOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.pickerCancel} 
              onPress={() => setPickerModalVisible(false)}
            >
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Scan Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeModal}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor }]}> 
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: textColor }]}>New AI Scan</Text>
            <TouchableOpacity onPress={closeModal}>
              <Ionicons name="close" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.modalImage} resizeMode="contain" />
            )}
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>{loadingMessage}</Text>
              </View>
            )}
            {error && !isLoading && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#ff6b6b" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {!isLoading && !error && extractedText && !aiAnswer && (
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Extracted Text</Text>
                <ScrollView style={styles.extractedTextView}>
                  <Text style={styles.extractedTextContent}>{extractedText}</Text>
                </ScrollView>
                <TouchableOpacity style={styles.getAnswerButton} onPress={getAIAnswer}>
                  <Ionicons name="sparkles-outline" size={20} color="white" style={{ marginRight: 8}}/>
                  <Text style={styles.getAnswerButtonText}>Get AI Answer (1 Credit)</Text>
                </TouchableOpacity>
              </View>
            )}
            {!isLoading && aiAnswer && (
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>AI Solution</Text>
                <ScrollView style={styles.responseContainer} showsVerticalScrollIndicator={false}>
                  <Text style={styles.responseText}>{aiAnswer}</Text>
                </ScrollView>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  listContent: {
    padding: 20,
  },
  scanCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
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
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  extractedTextView: {
    width: '100%',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 15,
  },
  extractedTextContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
  },
  getAnswerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  getAnswerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  responseContainer: {
    width: '100%',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 15,
  },
  responseText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffeeba',
  },
  errorText: {
    color: '#856404',
    fontSize: 14,
    marginLeft: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  featureBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    marginRight: 8,
  },
  featureBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
  },
  expandIcon: {
    marginLeft: 'auto',
  },
  expandedContent: {
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1,
  },
  expandedSection: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  expandedLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  expandedScrollView: {
    maxHeight: 150, // Limit height for expanded content
  },
  expandedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerModalContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
    width: '100%',
    backgroundColor: '#f0f7ff',
  },
  pickerOptionText: {
    marginLeft: 15,
    fontSize: 16,
    fontWeight: '500',
    color: '#6366f1',
  },
  pickerCancel: {
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  pickerCancelText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AIScan; 