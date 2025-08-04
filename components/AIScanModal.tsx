import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useThemeContext } from '../providers/ThemeProvider';

const { width, height } = Dimensions.get('window');

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
  primary: '#667eea',
  accentColor: '#667eea',
  dangerColor: '#ff6b6b',
  successColor: '#10b981',
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

interface AIScanModalProps {
  visible: boolean;
  onClose: () => void;
  onProcessComplete: (answer: string) => void;
  title?: string;
  subtitle?: string;
  accentColor?: string;
}

const AIScanModal: React.FC<AIScanModalProps> = ({
  visible,
  onClose,
  onProcessComplete,
  title = "AI Scan",
  subtitle = "Take a photo or choose from gallery to get AI-powered answers",
  accentColor,
}) => {
  const { resolvedTheme } = useThemeContext();
  const COLORS = getColors(resolvedTheme === 'dark');
  const finalAccentColor = accentColor || COLORS.accentColor;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Start animations when modal becomes visible
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulse animation for scan icon
      
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      slideAnim.setValue(50);
      pulseAnim.setValue(1);
    }
  }, [visible]);

  // Processing animation
 
  const clearError = () => {
    setError(null);
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      setIsProcessing(true);
      clearError();

      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Camera Permission Required', 'Please grant camera permission to take photos.');
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });

      if (!result.canceled && result.assets && result.assets[0].uri) {
        setImageUri(result.assets[0].uri);
        clearError();
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setError('Failed to pick image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessImage = async () => {
    if (!imageUri) {
      setError('Please select an image first');
      return;
    }

    try {
      setIsProcessing(true);
      clearError();
      
      // Call the parent component's onProcessComplete with the image URI
      onProcessComplete(imageUri);
      
      // Close the modal after a short delay to show processing state
      setTimeout(() => {
        handleClose();
      }, 300);
      
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetModal = () => {
    setImageUri(null);
    setError(null);
    setIsProcessing(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.modalSafeAreaView, { backgroundColor: COLORS.backgroundColor }]}>
        <Animated.View 
          style={[
            styles.modalContainer, 
            { backgroundColor: COLORS.backgroundColor },
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ]
            }
          ]}
        >
          {/* Modern Header */}
          <View style={[styles.modalHeader, { borderBottomColor: COLORS.borderColor }]}>
            <View style={styles.modalTitleContainer}>
              <View style={styles.titleSection}>
                <Text style={[styles.modalTitle, { color: COLORS.textColor.primary }]}>{title}</Text>
                <View style={[styles.accentLine, { backgroundColor: finalAccentColor }]} />
              </View>
              <TouchableOpacity 
                onPress={handleClose}
                style={[styles.closeButton, { backgroundColor: COLORS.cardColor }]}
              >
                <Ionicons name="close" size={20} color={COLORS.textColor.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <KeyboardAvoidingView 
            style={styles.contentContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView 
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {!imageUri && (
                <Animated.View 
                  style={[
                    styles.scanSection,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }]
                    }
                  ]}
                >
                  <View style={styles.scanIconContainer}>
                    <Animated.View
                      style={[
                        styles.scanIcon,
                        { backgroundColor: finalAccentColor },
                        { transform: [{ scale: pulseAnim }] }
                      ]}
                    >
                      <Ionicons name="sparkles" size={40} color={COLORS.textColor.white} />
                    </Animated.View>
                  </View>
                  
                  <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>AI-Powered Analysis</Text>
                  <Text style={[styles.sectionSubtitle, { color: COLORS.textColor.secondary }]}>
                    {subtitle}
                  </Text>
                  
                  <View style={styles.scanButtons}>
                    <TouchableOpacity 
                      style={[
                        styles.scanButton,
                        { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor },
                        isProcessing && styles.scanButtonDisabled
                      ]}
                      onPress={() => pickImage(true)}
                      disabled={isProcessing}
                    >
                      <Animated.View 
                        style={[
                          styles.scanButtonIcon, 
                          { backgroundColor: COLORS.backgroundColor },
                          { transform: [{ scale: pulseAnim }] }
                        ]}
                      >
                        <Ionicons name="camera-outline" size={28} color={finalAccentColor} />
                      </Animated.View>
                      <Text style={[styles.scanButtonText, { color: COLORS.textColor.primary }]}>Take Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.scanButton,
                        { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor },
                        isProcessing && styles.scanButtonDisabled
                      ]}
                      onPress={() => pickImage(false)}
                      disabled={isProcessing}
                    >
                      <Animated.View 
                        style={[
                          styles.scanButtonIcon, 
                          { backgroundColor: COLORS.backgroundColor },
                          { transform: [{ scale: pulseAnim }] }
                        ]}
                      >
                        <Ionicons name="image-outline" size={28} color={finalAccentColor} />
                      </Animated.View>
                      <Text style={[styles.scanButtonText, { color: COLORS.textColor.primary }]}>Choose from Library</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {imageUri && (
                <Animated.View 
                  style={[
                    styles.imageSection,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }]
                    }
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>Image Preview</Text>
                  <View style={[styles.imageContainer, { backgroundColor: COLORS.backgroundColor }]}> 
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                    {/* Processing scan line */}
                    {isProcessing && (
                      <Animated.View style={[styles.scanOverlay, { opacity: fadeAnim }]}> 
                        <Animated.View
                          style={[
                            styles.scanLine,
                            {
                              backgroundColor: finalAccentColor,
                              opacity: scanLineAnim.interpolate({
                                inputRange: [0, 0.05, 0.95, 1],
                                outputRange: [0, 0.85, 0.85, 0],
                              }),
                              transform: [{
                                translateY: scanLineAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, 280],
                                })
                              }]
                            }
                          ]}
                        />
                        <View style={styles.processingOverlay}>
                          <Ionicons name="sparkles" size={32} color={finalAccentColor} />
                          <Text style={[styles.processingText, { color: COLORS.textColor.primary }]}>
                            AI is analyzing...
                          </Text>
                        </View>
                      </Animated.View>
                    )}
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => {
                        setImageUri(null);
                        clearError();
                      }}
                    >
                      <Ionicons name="close" size={16} color={COLORS.textColor.white} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {error && !isProcessing && (
                <Animated.View 
                  style={[
                    styles.errorContainer,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }]
                    }
                  ]}
                >
                  <Ionicons name="alert-circle-outline" size={24} color={COLORS.dangerColor} />
                  <Text style={[styles.errorText, { color: COLORS.dangerColor }]}>{error}</Text>
                </Animated.View>
              )}
            </ScrollView>

            {imageUri && !isProcessing && !error && (
              <Animated.View 
                style={[
                  styles.generateButtonSection, 
                  { borderTopColor: COLORS.borderColor, backgroundColor: COLORS.backgroundColor },
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }]
                  }
                ]}
              >
                <TouchableOpacity
                  style={[styles.generateButton, { backgroundColor: finalAccentColor }]}
                  onPress={handleProcessImage}
                >
                  <Ionicons name="sparkles" size={20} color={COLORS.textColor.white} />
                  <Text style={[styles.generateButtonText, { color: COLORS.textColor.white }]}>Get AI Answer</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </KeyboardAvoidingView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalSafeAreaView: {
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
  titleSection: {
    alignItems: 'center',
    flex: 1,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  accentLine: {
    width: 60,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scanSection: {
    marginBottom: 24,
    alignItems: 'center',
    paddingTop: 20,
  },
  scanIconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scanIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300,
  },
  scanButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  scanButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonDisabled: {
    opacity: 0.5,
  },
  scanButtonIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  imageSection: {
    marginBottom: 24,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  previewImage: {
    width: '100%',
    height: 280,
  },
  removeImageButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: 4,
    borderRadius: 2,
  },
  processingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fee2e2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  errorText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
    fontWeight: '500',
  },
  generateButtonSection: {
    padding: 20,
    borderTopWidth: 1,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },
});

export default AIScanModal;