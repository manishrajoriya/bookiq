import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AIAnswerModal from '../../components/AIAnswerModal';
import ImageScanModal from '../../components/ImageScanModal';
import { useThemeContext } from '../../providers/ThemeProvider';
import { getAnswerFromGemini, processImage } from '../../services/geminiServices';
import { addHistory } from '../../services/historyStorage';
import subscriptionService from '../../services/subscriptionService';

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
  primary: '#667eea',
  accentColor: '#667eea',
  backgroundColor: isDark ? '#0f0f0f' : '#f8f9fa',
  cardColor: isDark ? '#1a1a1a' : '#ffffff',
  headerBackground: isDark ? '#1a1a1a' : '#ffffff',
  borderColor: isDark ? '#333333' : '#f0f0f0',
  textColor: {
    primary: isDark ? '#ffffff' : '#1a1a1a',
    secondary: isDark ? '#cccccc' : '#666',
    white: '#ffffff',
  },
});

const Index = () => {
  const router = useRouter();
  const { resolvedTheme } = useThemeContext();
  const COLORS = getColors(resolvedTheme === 'dark');
  
  const [imageScanVisible, setImageScanVisible] = useState(false);
  const [aiAnswerVisible, setAiAnswerVisible] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const [historyId, setHistoryId] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showGetAnswerButton, setShowGetAnswerButton] = useState(false);

  const handleImageProcessed = async (text: string) => {
    setExtractedText(text);
    setImageScanVisible(false);
    setShowGetAnswerButton(true);
    setAiAnswerVisible(true);
  };

  const handleGetAIAnswer = async () => {
    if (!extractedText) {
      Alert.alert('Error', 'No text available to analyze');
      return;
    }

    try {
      const hasEnoughCredits = await subscriptionService.spendCredits(1);
      if (!hasEnoughCredits) {
        Alert.alert(
          "Out of Credits",
          "You need at least 1 credit to get an AI answer.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => router.push('/paywall') }
          ]
        );
        return;
      }
      
      setIsProcessing(true);
      const answer = await getAnswerFromGemini(extractedText, 'ai-scan');
      setAiAnswer(answer);
      
      const newHistoryId = await addHistory('', 'ai-scan', extractedText, answer);
      setHistoryId(newHistoryId);
      setShowGetAnswerButton(false);
    } catch (error) {
      console.error('Error getting AI answer:', error);
      Alert.alert('Error', 'Failed to get AI answer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessImage = async (uri: string): Promise<string> => {
    try {
      const hasEnoughCredits = await subscriptionService.spendCredits(1);
      if (!hasEnoughCredits) {
        throw new Error('You need at least 1 credit to scan an image. Please get more credits to continue.');
      }
      return await processImage(uri);
    } catch (error: any) {
      if (error.message.includes('credits')) {
        throw error;
      }
      throw new Error('Failed to process image. Please try again.');
    }
  };

  const handleCloseImageScan = () => {
    setImageScanVisible(false);
  };

  const handleCloseAIAnswer = () => {
    setAiAnswerVisible(false);
    setExtractedText('');
    setAiAnswer('');
    setHistoryId(null);
    setShowGetAnswerButton(false);
  };

  const handleViewHistory = () => {
    setAiAnswerVisible(false);
    router.push('/explore');
  };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.backgroundColor }]}>
      <StatusBar 
        barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={COLORS.backgroundColor}
      />
      
      {/* Simple Header */}
      <View style={[styles.header, { backgroundColor: COLORS.headerBackground }]}>
        <Text style={[styles.headerTitle, { color: COLORS.textColor.primary }]}>
          AI Scan
        </Text>
        <Text style={[styles.headerSubtitle, { color: COLORS.textColor.secondary }]}>
          Scan an image and get AI-powered answers
        </Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Simple Icon */}
        <View style={[styles.iconContainer, { backgroundColor: COLORS.primary }]}>
          <Ionicons name="scan-outline" size={48} color={COLORS.textColor.white} />
        </View>

        {/* Simple Description */}
        <Text style={[styles.description, { color: COLORS.textColor.secondary }]}>
          Take a photo or upload an image to extract text and get intelligent answers
        </Text>

        {/* Single Action Button */}
        <TouchableOpacity 
          style={[styles.scanButton, isProcessing && styles.disabledButton]} 
          onPress={() => setImageScanVisible(true)}
          activeOpacity={0.8}
          disabled={isProcessing}
        >
          <LinearGradient
            colors={[COLORS.primary, '#5a67d8']}
            style={styles.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="camera-outline" size={20} color={COLORS.textColor.white} />
            <Text style={styles.scanButtonText}>
              {isProcessing ? 'Processing...' : 'Scan Image'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <ImageScanModal
        visible={imageScanVisible}
        onClose={handleCloseImageScan}
        onImageProcessed={handleImageProcessed}
        title="Scan Image"
        subtitle="Take a photo or choose from gallery"
        actionButtonText="Extract Text"
        actionButtonIcon="text-outline"
        accentColor={COLORS.primary}
        onProcessImage={handleProcessImage}
        showExtractedText={true}
        showActionButton={false}
      />

      <AIAnswerModal
        visible={aiAnswerVisible}
        onClose={handleCloseAIAnswer}
        onViewHistory={handleViewHistory}
        title="Extracted Text"
        question={extractedText}
        answer={isProcessing ? "Getting AI answer..." : aiAnswer}
        feature="ai-scan"
        accentColor={COLORS.primary}
        customActionButton={
          showGetAnswerButton && !isProcessing ? (
            <TouchableOpacity
              style={[styles.getAnswerButton, { backgroundColor: COLORS.primary }]}
              onPress={handleGetAIAnswer}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles-outline" size={20} color={COLORS.textColor.white} />
              <Text style={[styles.getAnswerButtonText, { color: COLORS.textColor.white }]}>
                Get AI Answer (1 Credit)
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  description: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 48,
    maxWidth: 300,
  },
  scanButton: {
    width: '100%',
    borderRadius: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  getAnswerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  getAnswerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default Index;