import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { getAnswerFromGemini, processImage } from '../../services/geminiServices';
import { addHistory, spendCredits, updateHistoryAnswer } from '../../services/historyStorage';

const Index = () => {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<number | null>(null);

  useEffect(() => {
    // Initialization is now done in _layout.tsx
  }, []);

  const handleScan = async () => {
    setError(null);
    setAnswer(null);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Camera permission is required to take photos');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets) {
      processSelectedImage(result.assets[0].uri);
    }
  };

  const handleGallery = async () => {
    setError(null);
    setAnswer(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets) {
      processSelectedImage(result.assets[0].uri);
    }
  };

  const processSelectedImage = async (uri: string) => {
    setImageUri(uri);
    setModalVisible(true);
    await scanImageForText(uri);
  };

  const scanImageForText = async (uri: string) => {
    setLoading(true);
    setError(null);
    setAnswer(null);
    setExtractedText(null);
    setHistoryId(null);
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
        setLoading(false);
        return;
      }
      const text = await processImage(uri);
      setExtractedText(text);
      const newHistoryId = await addHistory(uri, 'ai-scan', text, '');
      setHistoryId(newHistoryId);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
      console.error('Error in scanImageForText:', e);
    } finally {
      setLoading(false);
    }
  };

  const getAIAnswer = async () => {
    if (!extractedText || !imageUri || !historyId) {
      setError("Cannot get answer without a successful scan record.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hasEnoughCredits = await spendCredits(1);
      if (!hasEnoughCredits) {
        Alert.alert(
          "Out of Credits",
          "You need at least 1 credit to get an answer.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => router.push('/paywall') }
          ]
        );
        setLoading(false);
        return;
      }
      const aiAnswer = await getAnswerFromGemini(extractedText, 'ai-scan');
      setAnswer(aiAnswer);
      await updateHistoryAnswer(historyId, aiAnswer);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
      console.error('Error in getAIAnswer:', e);
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setImageUri(null);
    setAnswer(null);
    setError(null);
    setExtractedText(null);
    setLoading(false);
    setHistoryId(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Scan</Text>
        <Text style={styles.headerSubtitle}>Extract text and get insights from your images.</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.emptyIconContainer}>
            <Ionicons name="scan-outline" size={80} color="#e0e7ff" />
        </View>
        <Text style={styles.emptyTitle}>Ready to Scan</Text>
        <Text style={styles.emptySubtitle}>
            Use your camera or select an image from your gallery to get started.
        </Text>
        <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.scanButton} onPress={handleScan} activeOpacity={0.8}>
                <Ionicons name="camera-outline" size={20} color="#fff" />
                <Text style={styles.scanButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.galleryButton} onPress={handleGallery} activeOpacity={0.8}>
                <Ionicons name="images-outline" size={20} color="#6366f1" />
                <Text style={styles.galleryButtonText}>From Gallery</Text>
            </TouchableOpacity>
        </View>
      </View>

      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        transparent 
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Scan Result</Text>
                <TouchableOpacity onPress={closeModal} style={styles.closeIcon}>
                    <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
                {imageUri && (
                <Image 
                    source={{ uri: imageUri }} 
                    style={styles.image} 
                    resizeMode="contain" 
                />
                )}

                {loading && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#6366f1" />
                        <Text style={styles.loadingText}>Processing your image...</Text>
                    </View>
                )}
                
                {error && (
                    <View style={styles.errorBox}>
                        <Ionicons name="warning-outline" size={20} color="#ef4444" />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {extractedText && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Extracted Text</Text>
                    <View style={styles.textBox}>
                      <ScrollView style={styles.textScrollView}>
                        <Text style={styles.extractedText}>{extractedText}</Text>
                      </ScrollView>
                    </View>
                  </View>
                )}

                {answer && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>AI Analysis</Text>
                        <View style={styles.answerBox}>
                          <ScrollView style={styles.answerScrollView}>
                            <Text style={styles.answerText}>{answer}</Text>
                          </ScrollView>
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={styles.modalFooter}>
                {extractedText && !answer && !loading && (
                  <TouchableOpacity style={styles.getAnswerButton} onPress={getAIAnswer}>
                    <Ionicons name="sparkles-outline" size={20} color="white"/>
                    <Text style={styles.getAnswerButtonText}>Get AI Answer (1 Credit)</Text>
                  </TouchableOpacity>
                )}

                {(answer || error) && (
                    <TouchableOpacity 
                        style={styles.closeButton} 
                        onPress={closeModal}
                        disabled={loading}
                    >
                        <Text style={styles.closeButtonText}>Done</Text>
                    </TouchableOpacity>
                )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f9fafb' 
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  content: {
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  scanButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  scanButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600',
    marginLeft: 8,
  },
  galleryButton: {
    backgroundColor: '#eef2ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe'
  },
  galleryButtonText: {
    color: '#4338ca', 
    fontSize: 16, 
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    width: '100%', 
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  closeIcon: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  image: { 
    width: '100%', 
    height: 200, 
    borderRadius: 12, 
    marginBottom: 20,
    backgroundColor: '#f3f4f6',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 16,
    color: '#6b7280',
    fontSize: 16,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorText: { 
    color: '#b91c1c', 
    marginLeft: 12,
    fontSize: 15, 
    flex: 1,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    fontSize: 16,
  },
  textBox: {
    width: '100%',
  },
  answerBox: {
    width: '100%',
  },
  textScrollView: {
    maxHeight: 120,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  answerScrollView: {
    maxHeight: 200,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  extractedText: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 20,
  },
  answerText: { 
    color: '#374151', 
    fontSize: 15,
    lineHeight: 22,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  closeButton: {
    backgroundColor: '#6366f1', 
    borderRadius: 12, 
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: { 
    color: '#fff', 
    fontWeight: '600', 
    fontSize: 16 
  },
  getAnswerButton: {
    backgroundColor: '#22c55e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  getAnswerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default Index;