import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Dimensions,
    Platform,
    ScrollView,
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
import {
    addHistory,
    addNote,
    updateHistoryAnswer,
} from "../../services/historyStorage";
import subscriptionService from "../../services/subscriptionService";

const { width, height } = Dimensions.get('window');

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
  primary: '#667eea',
  accentColor: '#667eea',
  dangerColor: '#ff6b6b',
  successColor: '#10b981',
  backgroundColor: isDark ? '#0f0f0f' : '#ffffff',
  cardColor: isDark ? '#1a1a1a' : '#ffffff',
  headerBackground: isDark ? '#1a1a1a' : '#ffffff',
  borderColor: isDark ? '#333333' : '#f0f0f0',
  iconColor: isDark ? '#9BA1A6' : '#666',
  textColor: {
    primary: isDark ? '#ffffff' : '#1a1a1a',
    secondary: isDark ? '#cccccc' : '#666',
    light: isDark ? '#999999' : '#aaa',
    white: '#ffffff',
  },
});

const Explore = () => {
    const router = useRouter();
    
    // Theme context
    const { resolvedTheme } = useThemeContext();
    const COLORS = getColors(resolvedTheme === 'dark');

    const allTools = [
      { name: 'AI Scan', icon: 'scan-outline', color: '#667eea', bgColor: '#f0f2ff', feature: 'ai-scan' },
        { name: 'My Notes', icon: 'journal-outline', color: '#feca57', bgColor: '#fffef0', feature: 'notes' },
        { name: 'Scan Notes', icon: 'document-text-outline', color: '#4facfe', bgColor: '#f0faff', feature: 'study-notes' },
       // { name: 'Calculator', icon: 'calculator-outline', color: '#764ba2', bgColor: '#f5f0ff', feature: 'calculator' },
        { name: 'Quiz Maker', icon: 'help-circle-outline', color: '#f093fb', bgColor: '#fef0ff', feature: 'quiz-maker' },
        { name: 'Flash Cards', icon: 'albums-outline', color: '#43e97b', bgColor: '#f0fff4', feature: 'flash-cards' },
        { name: 'Homework', icon: 'book-outline', color: '#fa709a', bgColor: '#fff0f5', feature: 'homework' },
        { name: 'Magic Eraser', icon: 'sparkles-outline', color: '#ff6b6b', bgColor: '#fff0f0', feature: 'magic-eraser' },
       // { name: 'Voice Notes', icon: 'mic-outline', color: '#4ecdc4', bgColor: '#f0fffe', feature: 'voice-notes' },
       // { name: 'PDF Scanner', icon: 'document-outline', color: '#45b7d1', bgColor: '#f0f9ff', feature: 'pdf-scanner' },
        { name: 'Mind Maps', icon: 'git-network-outline', color: '#96ceb4', bgColor: '#f9fff9', feature: 'mind-maps' },
       // { name: 'Translator', icon: 'language-outline', color: '#ff9ff3', bgColor: '#fff0fe', feature: 'translator' },
    ];

    const allSubjects = [
        { name: 'Mathematics', icon: 'calculator-outline', color: '#667eea', feature: 'calculator' },
        { name: 'Physics', icon: 'magnet-outline', color: '#764ba2',  feature: 'physics' },
        { name: 'Chemistry', icon: 'flask-outline', color: '#f093fb',  feature: 'chemistry' },
        { name: 'Biology', icon: 'leaf-outline', color: '#43e97b', feature: 'biology' },
        { name: 'History', icon: 'time-outline', color: '#ff6b6b',  feature: 'study-notes' },
        { name: 'Geography', icon: 'earth-outline', color: '#4ecdc4',  feature: 'study-notes' },
      //  { name: 'Literature', icon: 'library-outline', color: '#45b7d1',  feature: 'study-notes' },
       // { name: 'Computer Science', icon: 'laptop-outline', color: '#96ceb4',  feature: 'ai-scan' },
       // { name: 'Economics', icon: 'trending-up-outline', color: '#feca57', feature: 'study-notes' },
       // { name: 'Psychology', icon: 'bulb-outline', color: '#ff9ff3',  feature: 'study-notes' },
    ];

    // Image scan modal state
    const [scanModalVisible, setScanModalVisible] = useState(false);
    const [pendingFeature, setPendingFeature] = useState<string | null>(null);
    const [pendingHistoryId, setPendingHistoryId] = useState<number | null>(null);
    const [showAllTools, setShowAllTools] = useState(false);
    const [showAllSubjects, setShowAllSubjects] = useState(false);

    // AI Answer modal state
    const [aiAnswerModalVisible, setAiAnswerModalVisible] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState<string>('');
    const [currentAnswer, setCurrentAnswer] = useState<string>('');
    const [currentFeature, setCurrentFeature] = useState<string>('ai-scan');

    // Display logic for tools and subjects
    const displayedTools = showAllTools ? allTools : allTools.slice(0, 6);
    const displayedSubjects = showAllSubjects ? allSubjects : allSubjects.slice(0, 4);

    const featureRouteMap: Record<string, string> = {
      'ai-scan': '/ai-scan',
      'study-notes': '/study-notes',
      'notes': '/notes',
      'quiz-maker': '/quiz-maker',
      'flash-cards': '/flash-cards',
      'mind-maps':'/mind-maps',
      'physics': '/physics',
      'chemistry': '/chemistry',
      'biology': '/biology',
      'mathematics': '/mathematics',
      // Add more features as needed
    };

    const handleToolPress = (feature: string) => {
      const route = featureRouteMap[feature];
      if (route) {
        router.push(route as any);
      } else {
        openScanModal(feature);
      }
    };

    const openScanModal = (feature: string) => {
      setPendingFeature(feature);
      setScanModalVisible(true);
    };

    const closeScanModal = () => {
      setScanModalVisible(false);
      setPendingFeature(null);
      setPendingHistoryId(null);
    };

    const processScannedImage = async (uri: string): Promise<string> => {
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
          throw new Error('Insufficient credits');
        }

        const text = await processImage(uri);
        if (!text || text.trim().length === 0) {
          throw new Error('No text could be detected in the image. Please try with a clearer image.');
        }

        return text.trim();
      } catch (error) {
        console.error('Image processing error:', error);
        throw new Error('Failed to process the image. Please try again with a clearer image.');
      }
    };

    const handleImageProcessed = async (extractedText: string) => {
      if (!pendingFeature) return;

      try {
        if (pendingFeature === 'study-notes') {
          // For study notes, create a note directly
          const title = extractedText.split('\n')[0].substring(0, 50) + (extractedText.split('\n')[0].length > 50 ? '...' : '');
          const noteId = await addNote(title, extractedText);
          await addHistory('', 'study-notes', title, extractedText);
          
          Alert.alert(
            'Note Created',
            'Your study note has been successfully created!',
            [{ text: 'OK' }]
          );
        } else {
          // For other features, create history entry and get AI answer
          const newHistoryId = await addHistory('', pendingFeature, extractedText, '');
          setPendingHistoryId(newHistoryId);
          
          // Get AI answer
                  const creditResult = await subscriptionService.spendCredits(1);
        if (!creditResult.success) {
          Alert.alert(
            "Out of Credits",
            creditResult.error || "You need at least 1 credit to get an answer.",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Get Credits", onPress: () => router.push('/paywall') }
            ]
          );
          return;
        }

          const answer = await getAnswerFromGemini(extractedText, pendingFeature);
          await updateHistoryAnswer(newHistoryId, answer);
          
          // Show AI Answer Modal
          setCurrentQuestion(extractedText);
          setCurrentAnswer(answer);
          setCurrentFeature(pendingFeature);
          setAiAnswerModalVisible(true);
        }
        
        // Close scan modal
        closeScanModal();
      } catch (error) {
        console.error('Failed to process:', error);
        Alert.alert('Error', 'Failed to process the request. Please try again.');
      }
    };

    const getModalTitle = () => {
      if (!pendingFeature) return "Scan Document";
      
      const featureMap: Record<string, string> = {
        'study-notes': 'Create Study Note',
        'ai-scan': 'AI Scan',
        'calculator': 'Math Problem',
        'physics': 'Physics Problem',
        'chemistry': 'Chemistry Problem',
        'biology': 'Biology Problem',
        'homework': 'Homework Help',
        'magic-eraser': 'Magic Eraser',
      };
      
      return featureMap[pendingFeature] || 'Scan Document';
    };

    const getModalSubtitle = () => {
      if (!pendingFeature) return "Take a photo or choose from gallery to extract text";
      
      const subtitleMap: Record<string, string> = {
        'study-notes': 'Take a photo or choose from gallery to create a study note',
        'ai-scan': 'Take a photo or choose from gallery to get AI analysis',
        'calculator': 'Take a photo of a math problem to get the solution',
        'physics': 'Take a photo of a physics problem to get the solution',
        'chemistry': 'Take a photo of a chemistry problem to get the solution',
        'biology': 'Take a photo of a biology problem to get the solution',
        'homework': 'Take a photo of your homework to get help',
        'magic-eraser': 'Take a photo to remove unwanted elements',
      };
      
      return subtitleMap[pendingFeature] || 'Take a photo or choose from gallery to extract text';
    };

    const getActionButtonText = () => {
      if (!pendingFeature) return "Process";
      
      const actionMap: Record<string, string> = {
        'study-notes': 'Create Note',
        'ai-scan': 'Get AI Answer',
        'calculator': 'Solve Problem',
        'physics': 'Get Solution',
        'chemistry': 'Get Solution',
        'biology': 'Get Solution',
        'homework': 'Get Help',
        'magic-eraser': 'Remove Elements',
      };
      
      return actionMap[pendingFeature] || 'Process';
    };

    const getActionButtonIcon = () => {
      if (!pendingFeature) return "sparkles-outline";
      
      const iconMap: Record<string, string> = {
        'study-notes': 'document-text-outline',
        'ai-scan': 'sparkles-outline',
        'calculator': 'calculator-outline',
        'physics': 'magnet-outline',
        'chemistry': 'flask-outline',
        'biology': 'leaf-outline',
        'homework': 'book-outline',
        'magic-eraser': 'sparkles-outline',
      };
      
      return iconMap[pendingFeature] || 'sparkles-outline';
    };

    return (
        <View style={[styles.container, { backgroundColor: COLORS.backgroundColor }]}>
            <StatusBar barStyle={COLORS.textColor.primary === '#fff' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.backgroundColor} />
            
            {/* Header */}
            <View style={[styles.header, { backgroundColor: COLORS.headerBackground, borderBottomColor: COLORS.borderColor }]}>
                <View>
                    <Text style={[styles.greeting, { color: COLORS.iconColor }]}>Good morning! 👋</Text>
                    <Text style={[styles.headerTitle, { color: COLORS.textColor.primary }]}>Ready to learn?</Text>
                </View>
                <View style={styles.headerButtons}>
                    <TouchableOpacity 
                        style={[styles.historyButton, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}
                        onPress={() => router.push('/HistoryList' as any)}
                    >
                        <Ionicons name="time-outline" size={20} color={COLORS.accentColor} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.profileButton}>
                        <View style={[styles.profileAvatar, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}>
                            <Ionicons name="person-outline" size={20} color={COLORS.iconColor} />
                        </View>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView 
                style={styles.scrollView} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
               

                {/* Quick Tools */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>Quick Tools</Text>
                        <TouchableOpacity onPress={() => setShowAllTools(!showAllTools)}>
                            <Text style={[styles.seeAllText, { color: COLORS.iconColor }]}>
                                {showAllTools ? 'Show less' : 'See all'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.toolsGrid}>
                        {displayedTools.map((tool, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={[styles.toolCard, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}
                                onPress={() => handleToolPress(tool.feature)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.toolIcon, { backgroundColor: tool.color }]}>
                                    <Ionicons name={tool.icon as any} size={20} color="white" />
                                </View>
                                <Text style={[styles.toolName, { color: COLORS.textColor.primary }]}>{tool.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Subjects */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: COLORS.textColor.primary }]}>Subjects</Text>
                        <TouchableOpacity onPress={() => setShowAllSubjects(!showAllSubjects)}>
                            <Text style={[styles.seeAllText, { color: COLORS.iconColor }]}>
                                {showAllSubjects ? 'Show less' : 'Browse all'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.subjectsContainer}>
                        {displayedSubjects.map((subject, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={[styles.subjectCard, { backgroundColor: COLORS.cardColor, borderColor: COLORS.borderColor }]}
                                onPress={() => openScanModal(subject.feature)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.subjectIcon, { backgroundColor: subject.color }]}>
                                    <Ionicons name={subject.icon as any} size={24} color="white" />
                                </View>
                                <View style={styles.subjectInfo}>
                                    <Text style={[styles.subjectName, { color: COLORS.textColor.primary }]}>{subject.name}</Text>
                                    
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={COLORS.iconColor} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Image Scan Modal */}
            <ImageScanModal
                visible={scanModalVisible}
                onClose={closeScanModal}
                onImageProcessed={handleImageProcessed}
                title={getModalTitle()}
                subtitle={getModalSubtitle()}
                actionButtonText={getActionButtonText()}
                actionButtonIcon={getActionButtonIcon()}
                accentColor={COLORS.accentColor}
                onProcessImage={processScannedImage}
                showExtractedText={true}
                showActionButton={true}
            />

            {/* AI Answer Modal */}
            <AIAnswerModal
                visible={aiAnswerModalVisible}
                onClose={() => setAiAnswerModalVisible(false)}
                onViewHistory={() => {
                    setAiAnswerModalVisible(false);
                    router.push('/HistoryList' as any);
                }}
                title={getModalTitle()}
                question={currentQuestion}
                answer={currentAnswer}
                feature={currentFeature}
                accentColor={COLORS.accentColor}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 20,
    },
    greeting: {
        fontSize: 16,
        color: '#666',
        marginBottom: 4,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    profileButton: {
        padding: 4,
    },
    profileAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f8f9ff',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#e8eaff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    mainCard: {
        marginBottom: 32,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    mainCardGradient: {
        padding: 24,
        minHeight: 180,
        flexDirection: 'row',
        alignItems: 'center',
    },
    mainCardContent: {
        flex: 1,
    },
    mainCardTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: 'white',
        marginBottom: 8,
    },
    mainCardSubtitle: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 22,
        marginBottom: 24,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    primaryButton: {
        backgroundColor: 'white',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#667eea',
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    mainCardIllustration: {
        position: 'relative',
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingCard: {
        width: 60,
        height: 60,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    section: {
        marginBottom: 32,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    seeAllText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#667eea',
    },
    toolsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    toolCard: {
        width: (width - 80) / 3,
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    toolIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    toolName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
    },
    subjectsContainer: {
        gap: 16,
    },
    subjectCard: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f0f0f0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    subjectIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    subjectInfo: {
        flex: 1,
    },
    subjectName: {
        fontSize: 17,
        fontWeight: '600',
        color: '#1a1a1a',
        marginBottom: 4,
    },
    subjectCount: {
        fontSize: 14,
        color: '#666',
    },
    headerButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    historyButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
});

export default Explore;