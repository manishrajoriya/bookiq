import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useThemeContext } from '../providers/ThemeProvider';
import subscriptionService from '../services/subscriptionService';

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

interface ImageScanModalProps {
  visible: boolean;
  onClose: () => void;
  onImageProcessed: (extractedText: string) => void;
  title?: string;
  subtitle?: string;
  actionButtonText?: string;
  actionButtonIcon?: string;
  accentColor?: string;
  onProcessImage?: (uri: string) => Promise<string>;
  showExtractedText?: boolean;
  showActionButton?: boolean;
}

const ImageScanModal: React.FC<ImageScanModalProps> = ({
  visible,
  onClose,
  onImageProcessed,
  title = "Scan Document",
  subtitle = "Take a photo or choose from gallery to extract text",
  actionButtonText = "Process",
  actionButtonIcon = "sparkles-outline",
  accentColor,
  onProcessImage,
  showExtractedText = true,
  showActionButton = true,
}) => {
  const { resolvedTheme } = useThemeContext();
  const COLORS = getColors(resolvedTheme === 'dark');
  const finalAccentColor = accentColor || COLORS.accentColor;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      slideAnim.setValue(50);
    }
  }, [visible]);

  // Scanning animation
  useEffect(() => {
    let scanLineLoop: Animated.CompositeAnimation | null = null;
    if (isScanning) {
      scanLineAnim.setValue(0);
      scanLineLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ])
      );
      scanLineLoop.start();
    } else {
      scanLineAnim.stopAnimation();
    }
    return () => {
      scanLineLoop?.stop();
    };
  }, [isScanning]);

  const clearError = () => {
    setError(null);
  };

  const handleCameraScan = async () => {
    try {
      setIsScanning(true);
      clearError();

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Please grant camera permission to scan documents.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.9,
        mediaTypes: ['images'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (onProcessImage) {
          await processImage(asset.uri);
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      setError('Failed to capture image. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleGalleryScan = async () => {
    try {
      setIsScanning(true);
      clearError();

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.9,
        mediaTypes: ['images'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (onProcessImage) {
          await processImage(asset.uri);
        }
      }
    } catch (error) {
      console.error('Gallery error:', error);
      setError('Failed to select image from gallery. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const processImage = async (uri: string) => {
    try {
      // Check credits before processing
      const creditResult = await subscriptionService.spendCredits(1);
      if (!creditResult.success) {
        Alert.alert(
          "Out of Credits",
          creditResult.error || "You need at least 1 credit to scan an image.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => {
              router.push('/paywall');
            }}
          ]
        );
        return;
      }

      if (onProcessImage) {
        const text = await onProcessImage(uri);
        if (!text || text.trim().length === 0) {
          setError('No text could be detected in the image. Please try with a clearer image.');
          return;
        }
        setExtractedText(text.trim());
        clearError();
      }
    } catch (error) {
      console.error('Image processing error:', error);
      setError('Failed to process the image. Please try again with a clearer image.');
    }
  };

  const handleActionButton = () => {
    if (extractedText) {
      onImageProcessed(extractedText);
      onClose();
    }
  };

  const resetModal = () => {
    setImageUri(null);
    setExtractedText('');
    setError(null);
    setIsScanning(false);
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
      <SafeAreaView style={[styles.modalSafeAreView, { backgroundColor: COLORS.backgroundColor }]}>
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
                      <Ionicons name="scan-outline" size={40} color={COLORS.textColor.white} />
                    </Animated.View>
                  </View>
                  
                  <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>Scan Document</Text>
                  <Text style={[styles.sectionSubtitle, { color: COLORS.textColor.secondary }]}>
                    {subtitle}
                  </Text>
                  
                  <View style={styles.scanButtons}>
                    <TouchableOpacity 
                      style={[
                        styles.scanButton,
                        { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor },
                        isScanning && styles.scanButtonDisabled
                      ]}
                      onPress={handleCameraScan}
                      disabled={isScanning}
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
                      <Text style={[styles.scanButtonText, { color: COLORS.textColor.primary }]}>Camera</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[
                        styles.scanButton,
                        { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor },
                        isScanning && styles.scanButtonDisabled
                      ]}
                      onPress={handleGalleryScan}
                      disabled={isScanning}
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
                      <Text style={[styles.scanButtonText, { color: COLORS.textColor.primary }]}>Gallery</Text>
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
                  <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>Document Preview</Text>
                  <View style={[styles.imageContainer, { backgroundColor: COLORS.backgroundColor }]}> 
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                    {/* Ultra-minimal scan line, no corners */}
                    {isScanning && (
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
                                  outputRange: [0, 200],
                                })
                              }]
                            }
                          ]}
                        />
                      </Animated.View>
                    )}
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => {
                        setImageUri(null);
                        setExtractedText('');
                        clearError();
                      }}
                    >
                      <Ionicons name="close" size={16} color={COLORS.textColor.white} />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}

              {isScanning && (
                <Animated.View 
                  style={[
                    styles.loadingContainer,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }]
                    }
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.loadingIcon,
                      { transform: [{ rotate: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }) }] }
                    ]}
                  >
                    <ActivityIndicator size="large" color={finalAccentColor} />
                  </Animated.View>
                  <Text style={[styles.loadingText, { color: COLORS.textColor.primary }]}>Processing image...</Text>
                </Animated.View>
              )}

              {error && !isScanning && (
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

              {showExtractedText && extractedText && !isScanning && !error && (
                <Animated.View 
                  style={[
                    styles.extractedTextSection,
                    {
                      opacity: fadeAnim,
                      transform: [{ translateY: slideAnim }]
                    }
                  ]}
                >
                  <View style={styles.textHeader}>
                    <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>Extracted Text</Text>
                    <View style={[styles.editIndicator, { backgroundColor: finalAccentColor }]}>
                      <Ionicons name="create-outline" size={14} color={COLORS.textColor.white} />
                      <Text style={[styles.editIndicatorText, { color: COLORS.textColor.white }]}>Editable</Text>
                    </View>
                  </View>
                  
                  <View style={[styles.extractedTextContainer, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}>
                    <TextInput
                      style={[styles.extractedTextInput, { 
                        color: COLORS.textColor.primary,
                        backgroundColor: 'transparent'
                      }]}
                      value={extractedText}
                      onChangeText={setExtractedText}
                      multiline
                      textAlignVertical="top"
                      placeholder="Edit extracted text..."
                      placeholderTextColor={COLORS.textColor.light}
                    />
                  </View>
                </Animated.View>
              )}
            </ScrollView>

            {showActionButton && extractedText && !isScanning && !error && (
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
                  onPress={handleActionButton}
                >
                  <Ionicons name={actionButtonIcon as any} size={20} color={COLORS.textColor.white} />
                  <Text style={[styles.generateButtonText, { color: COLORS.textColor.white }]}>{actionButtonText}</Text>
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
    fontSize: 24,
    fontWeight: '700',
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
  titleSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  accentLine: {
    width: 60,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    zIndex: 1,
  },
  scanLine: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    marginVertical: 0,
  },
  corner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 2,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingIcon: {
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
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
  extractedTextSection: {
    marginBottom: 24,
  },
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  extractedTextContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 120,
  },
  extractedTextInput: {
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    flex: 1,
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

export default ImageScanModal; 