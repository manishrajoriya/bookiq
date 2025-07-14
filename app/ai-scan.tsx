import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AIAnswerModal from '../components/AIAnswerModal';
import ImageScanModal from '../components/ImageScanModal';
import { useThemeColor } from '../hooks/useThemeColor';
import { getAnswerFromGemini, processImage } from '../services/geminiServices';
import { addHistory, getAllHistory, updateHistoryAnswer } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';
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
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [pendingHistoryId, setPendingHistoryId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // AI Answer modal state
  const [aiAnswerModalVisible, setAiAnswerModalVisible] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentAnswer, setCurrentAnswer] = useState<string>('');

  // Animation refs
  const scrollY = useRef(new Animated.Value(0)).current;

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

  const processSelectedImage = async (uri: string): Promise<string> => {
    setPendingHistoryId(null);
    try {
      const text = await processImage(uri);
      // Save to history
      const newHistoryId = await addHistory(uri, 'ai-scan', text, '');
      setPendingHistoryId(newHistoryId);
      return text;
    } catch (e: any) {
      const errorMessage = e.message || 'Something went wrong. Please try again.';
      Alert.alert('Error', errorMessage);
      throw new Error(errorMessage);
    } finally {
      setPendingHistoryId(null);
    }
  };

  const handleImageProcessed = async (extractedText: string) => {
    try {
      const hasEnoughCredits = await subscriptionService.spendCredits(1);
      if (!hasEnoughCredits) {
        Alert.alert(
          'Out of Credits',
          'You need at least 1 credit to get an answer.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Get Credits', onPress: () => router.push('/paywall') },
          ]
        );
        return;
      }
      const answer = await getAnswerFromGemini(extractedText, 'ai-scan');
      if (pendingHistoryId) {
        await updateHistoryAnswer(pendingHistoryId, answer);
      }
      
      // Show AI Answer Modal
      setCurrentQuestion(extractedText);
      setCurrentAnswer(answer);
      setAiAnswerModalVisible(true);
      
      // Refresh history after answer
      loadScanHistory();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Something went wrong. Please try again.');
    } finally {
      setPendingHistoryId(null);
    }
  };

  const closeModal = () => {
    setScanModalVisible(false);
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
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: textColor }]}>AI Scan</Text>
            <Text style={[styles.headerSubtitle, { color: iconColor }]}>
              {scanHistory.length} {scanHistory.length === 1 ? 'scan' : 'scans'}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: cardColor }]} 
              onPress={() => setScanModalVisible(true)}
            >
              <Ionicons name="add-outline" size={24} color="#667eea" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: cardColor }]} 
              onPress={() => setScanModalVisible(true)}
            >
              <Ionicons name="scan-outline" size={24} color="#667eea" />
            </TouchableOpacity>
          </View>
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
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
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
          style={[styles.fab, { backgroundColor: '#667eea' }]} 
          onPress={() => setScanModalVisible(true)}
          activeOpacity={0.9}
        >
          <Ionicons name="scan-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Scan Modal */}
      <ImageScanModal
        visible={scanModalVisible}
        onClose={closeModal}
        onImageProcessed={handleImageProcessed}
        title="AI Scan"
        subtitle="Take a photo or choose from gallery to extract text for AI analysis"
        actionButtonText="Get AI Answer (1 Credit)"
        actionButtonIcon="sparkles-outline"
        accentColor="#667eea"
        onProcessImage={processSelectedImage}
        showExtractedText={true}
        showActionButton={true}
      />

      {/* AI Answer Modal */}
      <AIAnswerModal
        visible={aiAnswerModalVisible}
        onClose={() => setAiAnswerModalVisible(false)}
        onViewHistory={() => {
          setAiAnswerModalVisible(false);
          router.push('/HistoryList' as any);
        }}
        title="AI Answer"
        question={currentQuestion}
        answer={currentAnswer}
        feature="ai-scan"
        accentColor="#667eea"
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 16,
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
    right: 24,
    bottom: 24,
  },
  fab: {
    backgroundColor: '#667eea',
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
  pickerCancelText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
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
});

export default AIScan; 