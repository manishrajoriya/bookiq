import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// App features data with images and navigation routes
const appFeatures = [
  {
    id: 1,
    title: 'AI Document Scanning',
    description: 'Scan any document and get instant AI-powered analysis and summaries',
    detailedDescription: 'Transform any document into actionable insights with our advanced AI scanning technology. Simply take a photo or upload a document, and our AI will extract text, analyze content, and provide intelligent summaries. Perfect for students, researchers, and professionals who need to quickly process large amounts of information.',
    icon: 'scan-outline',
    image: require('../assets/images/f1.jpeg'),
    color: '#4F46E5',
    route: '/',
    benefits: ['Instant text extraction', 'AI-powered analysis', 'Smart summaries', 'Multi-language support']
  },
  {
    id: 2,
    title: 'Smart Quiz Generation',
    description: 'Create personalized quizzes from your study materials automatically',
    detailedDescription: 'Never struggle with creating study materials again! Our AI automatically generates personalized quizzes from your notes, documents, or any study content. The system adapts to your learning style and creates questions that help you truly understand the material. Track your progress and focus on areas that need improvement.',
    icon: 'help-circle-outline',
    image: require('../assets/images/f2.jpeg'),
    color: '#059669',
    route: '/quiz-maker',
    benefits: ['Auto-generated questions', 'Personalized learning', 'Progress tracking', 'Multiple question types']
  },
  {
    id: 3,
    title: 'Interactive Flash Cards',
    description: 'Build and study with AI-generated flash cards for better retention',
    detailedDescription: 'Master any subject with our intelligent flash card system. Our AI creates comprehensive flash cards from your study materials, helping you memorize key concepts through spaced repetition. The interactive interface makes learning engaging and effective, with features like swipe gestures and progress tracking.',
    icon: 'albums-outline',
    image: require('../assets/images/f3.jpeg'),
    color: '#DC2626',
    route: '/flash-cards',
    benefits: ['AI-generated cards', 'Spaced repetition', 'Interactive interface', 'Progress tracking']
  },
  {
    id: 4,
    title: 'Mind Maps Creation',
    description: 'Visualize complex topics with AI-powered mind mapping tools',
    detailedDescription: 'Unlock the power of visual learning with our AI-powered mind mapping tool. Transform complex topics into clear, organized visual diagrams that help you understand relationships between concepts. Our AI automatically organizes information hierarchically, making it easier to remember and recall information during exams.',
    icon: 'git-network-outline',
    image: require('../assets/images/f4.jpeg'),
    color: '#7C3AED',
    route: '/mind-maps',
    benefits: ['AI-powered organization', 'Visual learning', 'Hierarchical structure', 'Easy recall']
  },
  {
    id: 5,
    title: 'Study Notes Organization',
    description: 'Keep all your notes organized and searchable in one place',
    detailedDescription: 'Keep all your study materials organized in one intelligent workspace. Our AI helps you categorize, tag, and search through your notes effortlessly. Create comprehensive study guides, add annotations, and never lose important information again. Perfect for long-term learning and exam preparation.',
    icon: 'document-text-outline',
    image: require('../assets/images/f3.jpeg'),
    color: '#EA580C',
    route: '/study-notes',
    benefits: ['Smart organization', 'Powerful search', 'Study guides', 'Cloud sync']
  },
  {
    id: 6,
    title: 'Multi-Subject Support',
    description: 'Study any subject from Mathematics to Biology with specialized tools',
    detailedDescription: 'From advanced mathematics to complex biology concepts, our platform adapts to any subject. Each discipline has specialized tools and features designed to enhance learning. Whether you\'re studying physics formulas, chemical reactions, or literary analysis, our AI provides subject-specific assistance and resources.',
    icon: 'school-outline',
    image: require('../assets/images/f2.jpeg'),
    color: '#0891B2',
    route: '/explore',
    benefits: ['Subject-specific tools', 'Adaptive learning', 'Comprehensive coverage', 'Specialized assistance']
  }
];

interface FeaturesModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FeatureDetailModalProps {
  visible: boolean;
  feature: typeof appFeatures[0] | null;
  onClose: () => void;
  onNavigate: (route: string) => void;
}

const FeatureDetailModal: React.FC<FeatureDetailModalProps> = ({ visible, feature, onClose, onNavigate }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 50, duration: 200, useNativeDriver: true })
      ]).start();
    }
  }, [visible]);

  if (!feature) return null;

  const handleNavigate = () => {
    onClose();
    setTimeout(() => {
      onNavigate(feature.route);
    }, 200);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.detailModalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <Animated.View
          style={[
            styles.detailModalContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.detailHeader}>
              <TouchableOpacity style={styles.detailCloseButton} onPress={onClose}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              
              <View style={[styles.detailIconContainer, { backgroundColor: feature.color }]}>
                <Ionicons name={feature.icon as any} size={32} color="#FFFFFF" />
              </View>
              
              <Text style={styles.detailTitle}>{feature.title}</Text>
            </View>

            {/* Feature Image */}
            <View style={styles.detailImageContainer}>
              <Image source={feature.image} style={styles.detailImage} />
            </View>

            {/* Description */}
            <View style={styles.detailContent}>
              <Text style={styles.detailDescription}>{feature.detailedDescription}</Text>
              
              {/* Benefits */}
              <View style={styles.benefitsSection}>
                <Text style={styles.benefitsTitle}>Key Benefits</Text>
                {feature.benefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <Ionicons name="checkmark-circle" size={20} color={feature.color} />
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.detailActions}>
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <Text style={styles.backButtonText}>Back to Features</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tryFeatureButton, { backgroundColor: feature.color }]} 
              onPress={handleNavigate}
            >
              <Text style={styles.tryFeatureButtonText}>Try This Feature</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const FeaturesModal: React.FC<FeaturesModalProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const [selectedFeature, setSelectedFeature] = useState<typeof appFeatures[0] | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  React.useEffect(() => {
    if (visible) {
      startAnimations();
    }
  }, [visible]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      })
    ]).start();
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      onClose();
    });
  };

  const handleFeaturePress = (feature: typeof appFeatures[0]) => {
    setSelectedFeature(feature);
    setDetailModalVisible(true);
  };

  const handleDetailClose = () => {
    setDetailModalVisible(false);
    setSelectedFeature(null);
  };

  const handleNavigate = (route: string) => {
    handleClose();
    setTimeout(() => {
      router.push(route as any);
    }, 300);
  };

  const handleGetStarted = () => {
    handleClose();
    setTimeout(() => {
      router.push('/');
    }, 300);
  };

  const renderFeatureCard = (feature: typeof appFeatures[0], index: number) => (
    <TouchableOpacity
      key={feature.id}
      style={[
        styles.featureCard,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim }
          ]
        }
      ]}
      onPress={() => handleFeaturePress(feature)}
      activeOpacity={0.8}
    >
      <View style={styles.featureImageContainer}>
        <Image source={feature.image} style={styles.featureImage} />
        <View style={[styles.iconOverlay, { backgroundColor: feature.color }]}>
          <Ionicons name={feature.icon as any} size={24} color="#FFFFFF" />
        </View>
      </View>
      
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureDescription}>{feature.description}</Text>
      </View>
      
      <View style={[styles.featureBadge, { backgroundColor: feature.color }]}>
        <Text style={styles.featureBadgeText}>NEW</Text>
      </View>
      
      <View style={styles.featureArrow}>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={handleClose} />
          
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIconContainer}>
                <Ionicons name="star" size={32} color="#FFD700" />
              </View>
              <Text style={styles.headerTitle}>App Features</Text>
              <Text style={styles.headerSubtitle}>Discover what BookIQ can do for you</Text>
              
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Features List */}
            <ScrollView 
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {appFeatures.map((feature, index) => renderFeatureCard(feature, index))}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.getStartedButton} onPress={handleGetStarted}>
                <Text style={styles.getStartedButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <FeatureDetailModal
        visible={detailModalVisible}
        feature={selectedFeature}
        onClose={handleDetailClose}
        onNavigate={handleNavigate}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#181818',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 20,
    position: 'relative',
  },
  headerIconContainer: {
    backgroundColor: '#222',
    borderRadius: 40,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#AAAAAA',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#333',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  featureCard: {
    backgroundColor: '#232323',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#333',
  },
  featureImageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  featureImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#444',
  },
  iconOverlay: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  featureDescription: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 20,
  },
  featureBadge: {
    position: 'absolute',
    top: 12,
    right: 40,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  featureBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  featureArrow: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  getStartedButton: {
    backgroundColor: '#FFD700',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedButtonText: {
    color: '#181818',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  // Detail Modal Styles
  detailModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  detailModalContainer: {
    backgroundColor: '#181818',
    borderRadius: 24,
    width: '100%',
    maxWidth: 450,
    maxHeight: '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  detailHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    position: 'relative',
  },
  detailCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#333',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  detailIconContainer: {
    borderRadius: 40,
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  detailTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detailImageContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  detailImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#444',
  },
  detailContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  detailDescription: {
    color: '#CCCCCC',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  benefitsSection: {
    marginBottom: 20,
  },
  benefitsTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    color: '#CCCCCC',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  detailActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  tryFeatureButton: {
    flex: 2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tryFeatureButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default FeaturesModal; 