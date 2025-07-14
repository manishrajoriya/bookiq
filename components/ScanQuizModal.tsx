import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
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
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { generateQuizFromNotes, processImage } from '../services/geminiServices';
import { addHistory, addQuiz } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

const { width, height } = Dimensions.get('window');

type QuizType = 'multiple-choice' | 'true-false' | 'fill-blank';

interface ScanQuizModalProps {
  visible: boolean;
  onClose: () => void;
  onQuizSaved: () => void;
}

interface QuizState {
  isGenerating: boolean;
  progress: number;
}

export default function ScanQuizModal({
  visible,
  onClose,
  onQuizSaved
}: ScanQuizModalProps) {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<string>('');
  const [selectedQuizType, setSelectedQuizType] = useState<QuizType>('multiple-choice');
  const [quizState, setQuizState] = useState<QuizState>({
    isGenerating: false,
    progress: 0
  });

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');

  const closeModal = () => {
    if (isScanning || quizState.isGenerating) {
      Alert.alert(
        'Operation in Progress',
        'Please wait for the current operation to complete.',
        [{ text: 'OK' }]
      );
      return;
    }
    onClose();
    setImageUri(null);
    setExtractedText('');
    setGeneratedQuiz('');
    setQuizState({ isGenerating: false, progress: 0 });
  };

  const handleCameraScan = async () => {
    try {
      setIsScanning(true);

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please grant camera permission to scan documents.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.9,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        await processScannedImage(asset.uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleGalleryScan = async () => {
    try {
      setIsScanning(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.9,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        await processScannedImage(asset.uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to select image from gallery. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const processScannedImage = async (uri: string) => {
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
        return;
      }

      const text = await processImage(uri);
      if (!text || text.trim().length === 0) {
        Alert.alert('No Text Detected', 'No text could be detected in the image. Please try with a clearer image.');
        return;
      }

      setExtractedText(text.trim());
    } catch (error) {
      console.error('Image processing error:', error);
      Alert.alert('Error', 'Failed to process the image. Please try again with a clearer image.');
    }
  };

  const generateQuizFromScan = async () => {
    if (!extractedText) return;

    try {
      setQuizState(prev => ({ ...prev, isGenerating: true }));

      const creditResult = await subscriptionService.spendCredits(2);
      if (!creditResult.success) {
        Alert.alert(
          "Out of Credits",
          creditResult.error || "You need at least 2 credits to generate a quiz.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => router.push('/paywall') }
          ]
        );
        return;
      }

      setQuizState(prev => ({ ...prev, progress: 30 }));

      const quiz = await generateQuizFromNotes(
        extractedText,
        selectedQuizType
      );

      setQuizState(prev => ({ ...prev, progress: 80 }));

      setGeneratedQuiz(quiz);
      setQuizState(prev => ({ ...prev, progress: 100 }));

      // Add to history
      await addHistory(imageUri || '', 'quiz-maker', 'Scanned Document', quiz);

    } catch (error) {
      console.error('Quiz generation error:', error);
      Alert.alert('Error', 'Failed to generate quiz. Please try again.');
    } finally {
      setQuizState(prev => ({ ...prev, isGenerating: false, progress: 0 }));
    }
  };

  const saveScannedQuiz = async () => {
    if (!generatedQuiz) return;

    try {
      const quizTitle = `Scanned Document - ${selectedQuizType.replace('-', ' ')} Quiz`;
      
      await addQuiz(
        quizTitle,
        generatedQuiz,
        selectedQuizType,
        0 // We'll calculate the actual number when parsing
      );

      Alert.alert(
        'Success!', 
        'Quiz has been saved successfully.',
        [{ text: 'OK' }]
      );
      
      onQuizSaved();
      closeModal();
    } catch (error) {
      console.error('Failed to save quiz:', error);
      Alert.alert('Error', 'Failed to save quiz. Please try again.');
    }
  };

  const renderQuizProgress = () => {
    if (!quizState.isGenerating) return null;
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Ionicons name="help-circle-outline" size={24} color="#f093fb" />
          <Text style={[styles.progressTitle, { color: textColor }]}>Generating Quiz...</Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View 
            style={[
              styles.progressBar,
              { width: `${quizState.progress}%` }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: textColor }]}>{quizState.progress}% complete</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={closeModal}
    >
      <SafeAreaView style={[styles.modalSafeAreView, { backgroundColor }]}>
        <View style={[styles.modalContainer, { backgroundColor }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <View style={styles.modalTitleContainer}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Scan for Quiz</Text>
              <TouchableOpacity 
                onPress={closeModal}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Scan Buttons - Only show if no image selected */}
            {!imageUri && (
              <View style={styles.scanSection}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Scan Document</Text>
                <Text style={[styles.sectionSubtitle, { color: iconColor }]}>
                  Take a photo or choose from gallery to extract text for quiz generation
                </Text>
                <View style={styles.scanButtons}>
                  <TouchableOpacity 
                    style={[
                      styles.scanButton,
                      isScanning && styles.scanButtonDisabled
                    ]}
                    onPress={handleCameraScan}
                    disabled={isScanning}
                  >
                    <View style={styles.scanButtonIcon}>
                      <Ionicons name="camera-outline" size={28} color="#f093fb" />
                    </View>
                    <Text style={[styles.scanButtonText, { color: textColor }]}>Camera</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.scanButton,
                      isScanning && styles.scanButtonDisabled
                    ]}
                    onPress={handleGalleryScan}
                    disabled={isScanning}
                  >
                    <View style={styles.scanButtonIcon}>
                      <Ionicons name="image-outline" size={28} color="#f093fb" />
                    </View>
                    <Text style={[styles.scanButtonText, { color: textColor }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Image Preview */}
            {imageUri && (
              <View style={styles.imageSection}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Document Preview</Text>
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
                      setGeneratedQuiz('');
                    }}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Extracted Text */}
            {extractedText && (
              <View style={styles.extractedTextSection}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Extracted Text</Text>
                <View style={[styles.extractedTextContainer, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }]}>
                  <Text style={[styles.extractedTextContent, { color: '#4b5563' }]}>{extractedText}</Text>
                </View>
              </View>
            )}

            {/* Quiz Settings */}
            {extractedText && (
              <View style={styles.quizSettingsSection}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Quiz Settings</Text>
                
                <View style={styles.settingGroup}>
                  <Text style={[styles.settingLabel, { color: textColor }]}>Quiz Type</Text>
                  <View style={styles.quizTypeButtons}>
                    {(['multiple-choice', 'true-false', 'fill-blank'] as QuizType[]).map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.quizTypeButton,
                          { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
                          selectedQuizType === type && { backgroundColor: '#f093fb', borderColor: '#f093fb' }
                        ]}
                        onPress={() => setSelectedQuizType(type)}
                      >
                        <Text style={[
                          styles.quizTypeButtonText,
                          { color: '#4b5563' },
                          selectedQuizType === type && { color: 'white' }
                        ]}>
                          {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Generated Quiz from Scan */}
            {generatedQuiz && (
              <View style={styles.quizSection}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Generated Quiz</Text>
                <View style={[styles.quizContent, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }]}>
                  <Text style={[styles.quizText, { color: '#374151' }]}>{generatedQuiz}</Text>
                </View>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveScannedQuiz}
                >
                  <Ionicons name="save-outline" size={20} color="white" />
                  <Text style={styles.saveButtonText}>Save Quiz</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Progress Indicator */}
            {renderQuizProgress()}
          </ScrollView>

          {/* Generate Quiz Button */}
          {extractedText && !generatedQuiz && (
            <View style={styles.generateButtonSection}>
              <TouchableOpacity
                style={[
                  styles.generateButton,
                  quizState.isGenerating && styles.generateButtonDisabled
                ]}
                onPress={generateQuizFromScan}
                disabled={quizState.isGenerating}
              >
                {quizState.isGenerating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={20} color="white" />
                    <Text style={styles.generateButtonText}>
                      Generate Quiz (2 Credits)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalSafeAreView: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    paddingTop: Platform.OS === 'ios' ? 12 : 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
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
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  scanButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  scanButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  scanButtonIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
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
  extractedTextSection: {
    marginBottom: 24,
  },
  extractedTextContainer: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  extractedTextContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  quizSettingsSection: {
    marginBottom: 24,
  },
  settingGroup: {
    marginBottom: 24,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quizTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quizTypeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  quizTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  quizSection: {
    marginBottom: 24,
  },
  quizContent: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  quizText: {
    fontSize: 14,
    lineHeight: 22,
  },
  saveButton: {
    backgroundColor: '#f093fb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    backgroundColor: '#f093fb',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  generateButtonSection: {
    marginTop: 16,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  generateButton: {
    backgroundColor: '#f093fb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
  },
  generateButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 