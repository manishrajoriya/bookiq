import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AIAnswerModal from '../components/AIAnswerModal';
import AIScanModal from '../components/AIScanModal';
import { useThemeColor } from '../hooks/useThemeColor';
import { getAnswerFromImage } from '../services/geminiServices';
import { addHistory, getAllHistory, updateHistoryAnswer } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

const { width, height } = Dimensions.get('window');

interface ScanHistoryItem {
  id: number;
  imageUri: string;
  aiAnswer: string;
  createdAt: string;
}

const AIScan = () => {
  const router = useRouter();
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [pendingHistoryId, setPendingHistoryId] = useState<number | null>(null);

  // AI Answer modal state
  const [aiAnswerModalVisible, setAiAnswerModalVisible] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<string>('');

  // Processing loading state
  const [processingModalVisible, setProcessingModalVisible] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('Analyzing image...');

  // Animation refs
  const scrollY = useRef(new Animated.Value(0)).current;
  const processingOpacity = useRef(new Animated.Value(0)).current;

  // Theme
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');

  // Load scan history
  const loadScanHistory = React.useCallback(async () => {
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

  // Animate processing modal
  const showProcessingModal = () => {
    setProcessingModalVisible(true);
    Animated.timing(processingOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const hideProcessingModal = () => {
    Animated.timing(processingOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setProcessingModalVisible(false);
    });
  };

  const processSelectedImage = async (uri: string) => {
    setPendingHistoryId(null);
    
    // Close scan modal and show processing modal
    setScanModalVisible(false);
    showProcessingModal();
    
    try {
      setProcessingStep('Checking credits...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Check and spend credits
      const creditResult = await subscriptionService.spendCredits(1);
      if (!creditResult.success) {
        hideProcessingModal();
        Alert.alert(
          'Out of Credits',
          creditResult.error || 'You need at least 1 credit to get an answer.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Get Credits', onPress: () => router.push('/paywall') },
          ]
        );
        throw new Error(creditResult.error || 'Insufficient credits');
      }
      
      setProcessingStep('Saving to history...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Save to history first with empty answer
      const newHistoryId = await addHistory(uri, 'ai-scan', '', '');
      setPendingHistoryId(newHistoryId);
      
      setProcessingStep('Analyzing image...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        // Get answer directly from image using Gemini
        const { answer } = await getAnswerFromImage(uri);
        
        setProcessingStep('Finalizing...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Update history with the answer
        await updateHistoryAnswer(newHistoryId, answer);
        
        // Hide processing modal and show answer modal
        hideProcessingModal();
        
        setTimeout(() => {
          setCurrentAnswer(answer);
          setAiAnswerModalVisible(true);
        }, 400);
        
      } catch (error) {
        // Note: The credit has already been spent, we don't need to refund it
        // as the spendCredits call is atomic - it only deducts on success
        console.error('Error processing image:', error);
        throw error;
      }
      
      // Refresh history
      await loadScanHistory();
      
    } catch (e: any) {
      hideProcessingModal();
      const errorMessage = e.message || 'Something went wrong. Please try again.';
      setTimeout(() => {
        Alert.alert('Error', errorMessage);
      }, 400);
    } finally {
      setPendingHistoryId(null);
    }
  };

  const closeModal = () => {
    setScanModalVisible(false);
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
                  <Text style={[styles.cardText, { color: textColor }]}> 
                    {item.aiAnswer}
                  </Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="scan" size={80} color={iconColor} style={{ marginBottom: 24 }} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No Scans Yet</Text>
              <Text style={[styles.emptySubtitle, { color: iconColor }]}>Scan an image to get AI-powered answers.</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Floating Action Button */}
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

      {/* AI Scan Modal */}
      <AIScanModal
        visible={scanModalVisible}
        onClose={closeModal}
        onProcessComplete={processSelectedImage}
        title="AI Scan"
        subtitle="Take a photo or choose from gallery to get AI-powered answers"
        accentColor="#667eea"
      />

      {/* Processing Modal */}
      <Modal
        visible={processingModalVisible}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
      >
        <Animated.View 
          style={[
            styles.processingOverlay,
            { opacity: processingOpacity }
          ]}
        >
          <View style={[styles.processingModal, { backgroundColor: cardColor }]}>
            <View style={styles.processingIcon}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
            <Text style={[styles.processingTitle, { color: textColor }]}>Processing Image</Text>
            <Text style={[styles.processingStep, { color: iconColor }]}>{processingStep}</Text>
            <View style={styles.processingProgress}>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[
                    styles.progressFill,
                    {
                      width: processingStep === 'Checking credits...' ? '25%' :
                             processingStep === 'Saving to history...' ? '50%' :
                             processingStep === 'Getting AI answer...' ? '75%' :
                             processingStep === 'Finalizing...' ? '100%' : '0%'
                    }
                  ]} 
                />
              </View>
            </View>
          </View>
        </Animated.View>
      </Modal>

      {/* AI Answer Modal */}
      <AIAnswerModal
        visible={aiAnswerModalVisible}
        onClose={() => setAiAnswerModalVisible(false)}
        onViewHistory={() => {
          setAiAnswerModalVisible(false);
          router.push('/HistoryList' as any);
        }}
        title="AI Answer"
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
  // Processing Modal Styles
  processingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  processingIcon: {
    marginBottom: 24,
    padding: 20,
    borderRadius: 50,
    backgroundColor: '#f0f4ff',
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  processingStep: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  processingProgress: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: 200,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
});

export default AIScan;