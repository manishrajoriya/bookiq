import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { processImage } from '../services/geminiServices';
import { spendCredits } from '../services/historyStorage';

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
  const [showPickerModal, setShowPickerModal] = useState(false);

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

  const openScanPicker = () => {
    setShowPickerModal(true);
  };

  const handleCameraScan = async () => {
    try {
      setIsProcessing(true);
      setShowPickerModal(false);

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please grant camera permission to scan documents.');
        setIsProcessing(false);
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.9,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

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
      setShowPickerModal(false);

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.9,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

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
      setIsProcessing(false);
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      Alert.alert('Error', 'Invalid image selected. Please try again.');
      setIsProcessing(false);
      return;
    }

    setImageUri(asset.uri);

    try {
      const hasEnoughCredits = await spendCredits(1);
      if (!hasEnoughCredits) {
        Alert.alert('Insufficient Credits', 'Please purchase more credits to continue scanning.');
        setIsProcessing(false);
        return;
      }

      const text = await processImage(asset.uri);
      
      if (!text || text.trim().length === 0) {
        Alert.alert('No Text Detected', 'No text could be detected in the image. Please try with a clearer image.');
        setIsProcessing(false);
        return;
      }

      setExtractedText(text);
      setAppendedContent(text);
    } catch (error) {
      console.error('Image processing error:', error);
      Alert.alert('Error', 'Failed to process the image. Please try again with a clearer image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAppend = () => {
    if (!appendedContent.trim()) {
      Alert.alert('Error', 'Please add some content to append to the note.');
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
      transparent
      onRequestClose={closeModal}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.dragHandle} />
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Append to Note</Text>
                <TouchableOpacity 
                  onPress={closeModal}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Text style={styles.noteTitle}>{noteTitle}</Text>
            </View>

            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Scan Buttons - Only show if no image selected */}
              {!imageUri && (
                <View style={styles.scanSection}>
                  <Text style={styles.sectionTitle}>Scan Additional Content</Text>
                  <Text style={styles.sectionSubtitle}>
                    Take a photo or choose from gallery to add more content
                  </Text>
                  <View style={styles.scanButtons}>
                    <TouchableOpacity 
                      style={[
                        styles.scanButton,
                        isProcessing && styles.scanButtonDisabled
                      ]}
                      onPress={handleCameraScan}
                      disabled={isProcessing}
                    >
                      <View style={styles.scanButtonIcon}>
                        <Ionicons name="camera-outline" size={28} color="#6366f1" />
                      </View>
                      <Text style={styles.scanButtonText}>Camera</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.scanButton,
                        isProcessing && styles.scanButtonDisabled
                      ]}
                      onPress={handleGalleryScan}
                      disabled={isProcessing}
                    >
                      <View style={styles.scanButtonIcon}>
                        <Ionicons name="image-outline" size={28} color="#6366f1" />
                      </View>
                      <Text style={styles.scanButtonText}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Image Preview */}
              {imageUri && (
                <View style={styles.imageSection}>
                  <Text style={styles.sectionTitle}>Document Preview</Text>
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
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

              {/* Processing Indicator */}
              {isProcessing && (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color="#6366f1" />
                  <Text style={styles.processingText}>Processing image...</Text>
                </View>
              )}

              {/* Extracted Text Preview */}
              {extractedText && !isProcessing && (
                <View style={styles.extractedSection}>
                  <Text style={styles.sectionTitle}>Extracted Text</Text>
                  <View style={styles.extractedTextPreview}>
                    <Text style={styles.extractedText} numberOfLines={5}>
                      {extractedText.substring(0, 200)}...
                    </Text>
                  </View>
                </View>
              )}

              {/* Content Editor */}
              {(extractedText || appendedContent) && (
                <View style={styles.contentSection}>
                  <Text style={styles.sectionTitle}>Content to Append</Text>
                  <Text style={styles.sectionSubtitle}>
                    Edit the content before appending to your note
                  </Text>
                  <View style={styles.contentInputContainer}>
                    <TextInput
                      style={styles.contentInput}
                      value={appendedContent}
                      onChangeText={setAppendedContent}
                      placeholder="Content to append to your note..."
                      placeholderTextColor="#9ca3af"
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Append Button */}
            {(extractedText || appendedContent) && (
              <View style={styles.appendSection}>
                <TouchableOpacity
                  style={[
                    styles.appendButton,
                    isProcessing && styles.appendButtonDisabled
                  ]}
                  onPress={handleAppend}
                  disabled={isProcessing}
                >
                  <Ionicons name="add-circle-outline" size={20} color="white" />
                  <Text style={styles.appendButtonText}>
                    Append to Note
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Picker Modal for image source selection */}
      {showPickerModal && (
        <Modal
          transparent
          animationType="fade"
          visible={showPickerModal}
          onRequestClose={() => setShowPickerModal(false)}
        >
          <TouchableOpacity 
            style={styles.pickerModalOverlay}
            activeOpacity={1}
            onPress={() => setShowPickerModal(false)}
          >
            <View style={styles.pickerModalContainer}>
              <TouchableOpacity 
                style={styles.pickerOption} 
                onPress={() => { setShowPickerModal(false); handleCameraScan(); }}
              >
                <Ionicons name="camera-outline" size={24} color="#6366f1" />
                <Text style={styles.pickerOptionText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.pickerOption} 
                onPress={() => { setShowPickerModal(false); handleGalleryScan(); }}
              >
                <Ionicons name="image-outline" size={24} color="#6366f1" />
                <Text style={styles.pickerOptionText}>Choose from Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.pickerCancel} 
                onPress={() => setShowPickerModal(false)}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  noteTitle: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
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
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  scanButtonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eef2ff',
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
    color: '#4b5563',
  },
  imageSection: {
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
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
  processingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginBottom: 24,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '500',
  },
  extractedSection: {
    marginBottom: 24,
  },
  extractedTextPreview: {
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  extractedText: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  contentSection: {
    marginBottom: 24,
  },
  contentInputContainer: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    minHeight: 120,
  },
  contentInput: {
    padding: 16,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
  },
  appendSection: {
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
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  appendButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#9ca3af',
  },
  appendButtonText: {
    color: 'white',
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
    backgroundColor: 'white',
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
    borderBottomColor: '#f3f4f6',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#111827',
    marginLeft: 16,
  },
  pickerCancel: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  pickerCancelText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
}); 