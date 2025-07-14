import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
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

interface AIAnswerModalProps {
  visible: boolean;
  onClose: () => void;
  onViewHistory?: () => void;
  title?: string;
  question?: string;
  answer?: string;
  feature?: string;
  accentColor?: string;
  customActionButton?: React.ReactNode;
}

const AIAnswerModal: React.FC<AIAnswerModalProps> = ({
  visible,
  onClose,
  onViewHistory,
  title = "AI Answer",
  question = "",
  answer = "",
  feature = "ai-scan",
  accentColor,
  customActionButton,
}) => {
  const { resolvedTheme } = useThemeContext();
  const COLORS = getColors(resolvedTheme === 'dark');
  const finalAccentColor = accentColor || COLORS.accentColor;

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
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

  const getFeatureIcon = () => {
    const iconMap: Record<string, string> = {
      'ai-scan': 'sparkles-outline',
      'calculator': 'calculator-outline',
      'physics': 'magnet-outline',
      'chemistry': 'flask-outline',
      'biology': 'leaf-outline',
      'homework': 'book-outline',
      'magic-eraser': 'sparkles-outline',
      'mathematics': 'calculator-outline',
    };
    return iconMap[feature] || 'sparkles-outline';
  };

  const getFeatureColor = () => {
    const colorMap: Record<string, string> = {
      'ai-scan': '#667eea',
      'calculator': '#764ba2',
      'physics': '#764ba2',
      'chemistry': '#f093fb',
      'biology': '#43e97b',
      'homework': '#fa709a',
      'magic-eraser': '#ff6b6b',
      'mathematics': '#667eea',
    };
    return colorMap[feature] || finalAccentColor;
  };

  const formatFeatureName = (feature: string): string => {
    return feature.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
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
                <View style={styles.titleRow}>
                  <View style={[styles.featureIcon, { backgroundColor: getFeatureColor() }]}>
                    <Ionicons name={getFeatureIcon() as any} size={20} color={COLORS.textColor.white} />
                  </View>
                  <Text style={[styles.modalTitle, { color: COLORS.textColor.primary }]}>{title}</Text>
                </View>
                <View style={[styles.accentLine, { backgroundColor: getFeatureColor() }]} />
              </View>
              <TouchableOpacity 
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: COLORS.cardColor }]}
              >
                <Ionicons name="close" size={20} color={COLORS.textColor.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Feature Badge */}
            <View style={styles.featureBadgeContainer}>
              <View style={[styles.featureBadge, { backgroundColor: getFeatureColor() }]}>
                <Ionicons name={getFeatureIcon() as any} size={16} color={COLORS.textColor.white} />
                <Text style={[styles.featureBadgeText, { color: COLORS.textColor.white }]}>
                  {formatFeatureName(feature)}
                </Text>
              </View>
            </View>

            {/* Question Section */}
            {question && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>Question</Text>
                <View style={[styles.questionContainer, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}>
                  <Text style={[styles.questionText, { color: COLORS.textColor.secondary }]}>
                    {question}
                  </Text>
                </View>
              </View>
            )}

            {/* Answer Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>AI Answer</Text>
              <View style={[styles.answerContainer, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}>
                <ScrollView style={styles.answerScrollView} showsVerticalScrollIndicator={false}>
                  <Text style={[styles.answerText, { color: COLORS.textColor.primary }]}>
                    {answer || "No answer available"}
                  </Text>
                </ScrollView>
              </View>
            </View>

            {/* Custom Action Button */}
            {customActionButton && (
              <View style={styles.customActionContainer}>
                {customActionButton}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              {onViewHistory && (
                <TouchableOpacity
                  style={[styles.historyButton, { backgroundColor: COLORS.backgroundColor, borderColor: COLORS.borderColor }]}
                  onPress={onViewHistory}
                >
                  <Ionicons name="time-outline" size={18} color={getFeatureColor()} />
                  <Text style={[styles.historyButtonText, { color: getFeatureColor() }]}>View History</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity
                style={[styles.shareButton, { backgroundColor: getFeatureColor() }]}
                onPress={() => {
                  // TODO: Implement share functionality
                  console.log('Share answer');
                }}
              >
                <Ionicons name="share-outline" size={18} color={COLORS.textColor.white} />
                <Text style={[styles.shareButtonText, { color: COLORS.textColor.white }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  accentLine: {
    width: 60,
    height: 4,
    borderRadius: 2,
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
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  featureBadgeContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featureBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  questionContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  questionText: {
    fontSize: 16,
    lineHeight: 24,
  },
  answerContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: 200,
  },
  answerScrollView: {
    flex: 1,
  },
  answerText: {
    fontSize: 16,
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  customActionContainer: {
    width: '100%',
    marginBottom: 12,
  },
  historyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default AIAnswerModal; 