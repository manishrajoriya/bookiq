import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
    View,
} from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { processImage } from '../services/geminiServices';
import subscriptionService from '../services/subscriptionService';

const { width, height } = Dimensions.get('window');

interface AppendScanModalProps {
  visible: boolean;
  onClose: () => void;
  onAppend: (newContent: string) => void;
  existingContent: string;
  noteTitle: string;
}

export default function AppendScanModal({
  visible,
  onClose,
  onAppend,
  existingContent,
  noteTitle,
}: AppendScanModalProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [appendedContent, setAppendedContent] = useState('');

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');

  const resetModalState = () => {
    setImageUri(null);
    setExtractedText('');
    setAppendedContent('');
    setIsProcessing(false);
  };

  const closeModal = () => {
    if (isProcessing) {
      Alert.alert(
        'Processing in Progress',
        'Please wait for the current operation to complete.',
        [{ text: 'OK' }]
      );
      return;
    }
    resetModalState();
    onClose();
  };

  const handleCameraScan = async () => {
    try {
      setIsProcessing(true);
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please grant camera permission to scan documents.');
        setIsProcessing(false);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.9 });
      await handleImageSelection(result);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGalleryScan = async () => {
    try {
      setIsProcessing(true);
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.9 });
      await handleImageSelection(result);
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to select image from gallery. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageSelection = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }
    const asset = result.assets[0];
    setImageUri(asset.uri);
    try {
      const creditResult = await subscriptionService.spendCredits(1);
      if (!creditResult.success) {
        Alert.alert('Insufficient Credits', creditResult.error || 'Please purchase more credits to continue scanning.');
        return;
      }
      const text = await processImage(asset.uri);
      if (!text || text.trim().length === 0) {
        Alert.alert('No Text Detected', 'No text could be detected in the image.');
        return;
      }
      setExtractedText(text);
      setAppendedContent(text);
    } catch (error) {
      console.error('Image processing error:', error);
      Alert.alert('Error', 'Failed to process the image.');
    }
  };

  const handleAppend = () => {
    if (!appendedContent.trim()) {
      Alert.alert('Error', 'Please add some content to append.');
      return;
    }
    const newContent = existingContent + '\n\n' + appendedContent.trim();
    onAppend(newContent);
    closeModal();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={closeModal}
    >
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <StatusBar barStyle={backgroundColor === '#fff' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
        <View style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}>
          <View>
            <Text style={[styles.headerTitle, { color: textColor }]}>Append to Note</Text>
            <Text style={[styles.headerSubtitle, { color: iconColor }]} numberOfLines={1}>
              {noteTitle}
            </Text>
          </View>
          <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={iconColor} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!imageUri && (
            <View style={styles.scanSection}>
              <Text style={styles.sectionTitle}>Add Content</Text>
              <Text style={styles.sectionSubtitle}>
                Scan a document or choose from your gallery.
              </Text>
              <View style={styles.scanButtons}>
                <TouchableOpacity
                  style={[styles.scanButton, isProcessing && styles.scanButtonDisabled]}
                  onPress={handleCameraScan}
                  disabled={isProcessing}
                >
                  <Ionicons name="camera-outline" size={28} color="#6366f1" />
                  <Text style={styles.scanButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.scanButton, isProcessing && styles.scanButtonDisabled]}
                  onPress={handleGalleryScan}
                  disabled={isProcessing}
                >
                  <Ionicons name="image-outline" size={28} color="#10b981" />
                  <Text style={styles.scanButtonText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {isProcessing && !imageUri && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.processingText}>Preparing scanner...</Text>
            </View>
          )}

          {imageUri && (
            <View style={styles.imageSection}>
              <Text style={styles.sectionTitle}>Scanned Image</Text>
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
                {isProcessing && (
                  <View style={styles.imageOverlay}>
                    <ActivityIndicator size="large" color="white" />
                    <Text style={styles.imageOverlayText}>Extracting text...</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => {
                    setImageUri(null);
                    setExtractedText('');
                    setAppendedContent('');
                  }}
                >
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {(extractedText || appendedContent) && !isProcessing && (
            <View style={styles.contentSection}>
              <Text style={styles.sectionTitle}>Content to Append</Text>
              <View style={styles.contentInputContainer}>
                <TextInput
                  style={styles.contentInput}
                  value={appendedContent}
                  onChangeText={setAppendedContent}
                  placeholder="Edit your scanned text here..."
                  placeholderTextColor="#9ca3af"
                  multiline
                />
              </View>
            </View>
          )}
        </ScrollView>

        {(extractedText || appendedContent) && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.appendButton, isProcessing && styles.appendButtonDisabled]}
              onPress={handleAppend}
              disabled={isProcessing}
            >
              <Ionicons name="add-circle-outline" size={22} color="white" />
              <Text style={styles.appendButtonText}>Append to Note</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: 'white',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    maxWidth: width * 0.7,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scanSection: {
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  scanButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 8,
  },
  imageSection: {
    marginVertical: 24,
  },
  imageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  previewImage: {
    width: '100%',
    height: 250,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 6,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlayText: {
    color: 'white',
    marginTop: 8,
    fontWeight: '500',
  },
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '500',
  },
  contentSection: {
    marginBottom: 24,
  },
  contentInputContainer: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    minHeight: 150,
  },
  contentInput: {
    padding: 16,
    fontSize: 16,
    color: '#111827',
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: 'white',
  },
  appendButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  appendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  appendButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 