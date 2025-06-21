import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
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
import { addHistory, spendCredits } from '../../services/historyStorage';

const Index = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  useEffect(() => {
    // Initialization is now done in _layout.tsx
  }, []);

  const showImagePickerOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Gallery'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) await handleScan();
          if (buttonIndex === 2) await handleGallery();
        }
      );
    } else {
      // Android - show custom modal for options
      Alert.alert(
        'Select Image',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => handleScan() },
          { text: 'Choose from Gallery', onPress: () => handleGallery() }
        ]
      );
    }
  };

  const handleScan = async () => {
    setError(null);
    setAnswer(null);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to take photos',
        [{ text: 'OK' }]
      );
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
    try {
      const hasEnoughCredits = await spendCredits(1);
      if (!hasEnoughCredits) {
        setError("Not enough credits to scan image. You need at least 1 credit.");
        setLoading(false);
        return;
      }
      const text = await processImage(uri);
      setExtractedText(text);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
      console.error('Error in scanImageForText:', e);
    } finally {
      setLoading(false);
    }
  };

  const getAIAnswer = async () => {
    if (!extractedText || !imageUri) {
      setError("Cannot get answer without extracted text and image.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hasEnoughCredits = await spendCredits(1);
      if (!hasEnoughCredits) {
        setError("Not enough credits for an answer. You need 1 more credit.");
        setLoading(false);
        return;
      }
      const aiAnswer = await getAnswerFromGemini(extractedText, 'ai-scan');
      setAnswer(aiAnswer);
      addHistory(imageUri, 'ai-scan', extractedText, aiAnswer);
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
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Image AI Scanner</Text>
        <Text style={styles.subHeader}>Get insights from your images</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.scanButton} 
          onPress={showImagePickerOptions}
          activeOpacity={0.8}
        >
          <Ionicons name="scan" size={24} color="white" style={styles.buttonIcon} />
          <Text style={styles.scanButtonText}>Scan Image</Text>
        </TouchableOpacity>
      </View>

      <Modal 
        visible={modalVisible} 
        animationType="slide" 
        transparent 
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeIcon} 
              onPress={closeModal}
              hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>

            {imageUri && (
              <Image 
                source={{ uri: imageUri }} 
                style={styles.image} 
                resizeMode="contain" 
              />
            )}

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Processing your image...</Text>
              </View>
            ) : (
              <>
                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="warning" size={20} color="#ef4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {extractedText && (
                  <View style={styles.textBox}>
                    <Text style={styles.sectionTitle}>Extracted Text</Text>
                    <ScrollView style={styles.textScrollView}>
                      <Text style={styles.extractedText}>{extractedText}</Text>
                    </ScrollView>
                  </View>
                )}

                {extractedText && !answer && !loading && (
                  <TouchableOpacity style={styles.getAnswerButton} onPress={getAIAnswer}>
                    <Ionicons name="sparkles-outline" size={20} color="white" style={{ marginRight: 8}}/>
                    <Text style={styles.getAnswerButtonText}>Get AI Answer (1 Credit)</Text>
                  </TouchableOpacity>
                )}

                {answer && (
                  <View style={styles.answerBox}>
                    <Text style={styles.sectionTitle}>AI Analysis</Text>
                    <ScrollView style={styles.answerScrollView}>
                      <Text style={styles.answerText}>{answer}</Text>
                    </ScrollView>
                  </View>
                )}
              </>
            )}

            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={closeModal}
              disabled={loading}
            >
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subHeader: {
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  scanButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonIcon: {
    marginRight: 12,
  },
  scanButtonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '600' 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 24, 
    width: '90%', 
    maxHeight: '80%',
    position: 'relative',
  },
  closeIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
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
    paddingVertical: 24,
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
    marginLeft: 8,
    fontSize: 15, 
    flex: 1,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    fontSize: 16,
  },
  textBox: {
    marginBottom: 16,
    width: '100%',
  },
  answerBox: {
    width: '100%',
  },
  textScrollView: {
    maxHeight: 100,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  answerScrollView: {
    maxHeight: 150,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
  },
  extractedText: {
    color: '#374151',
    fontSize: 14,
  },
  answerText: { 
    color: '#374151', 
    fontSize: 15,
    lineHeight: 22,
  },
  closeButton: { 
    marginTop: 24, 
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
    marginTop: 8,
    marginBottom: 16,
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
  },
});

export default Index;