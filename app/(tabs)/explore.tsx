import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { getAnswerFromGemini, processImage } from '../../services/geminiServices';
import {
    addHistory,
    addNote,
    spendCredits,
    updateHistoryAnswer,
} from "../../services/historyStorage";

const { width, height } = Dimensions.get('window');

const Explore = () => {
    const router = useRouter();

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
        { name: 'Physics', icon: 'magnet-outline', color: '#764ba2',  feature: 'ai-scan' },
        { name: 'Chemistry', icon: 'flask-outline', color: '#f093fb',  feature: 'ai-scan' },
        { name: 'Biology', icon: 'leaf-outline', color: '#43e97b', feature: 'ai-scan' },
        { name: 'History', icon: 'time-outline', color: '#ff6b6b',  feature: 'study-notes' },
        { name: 'Geography', icon: 'earth-outline', color: '#4ecdc4',  feature: 'study-notes' },
      //  { name: 'Literature', icon: 'library-outline', color: '#45b7d1',  feature: 'study-notes' },
       // { name: 'Computer Science', icon: 'laptop-outline', color: '#96ceb4',  feature: 'ai-scan' },
       // { name: 'Economics', icon: 'trending-up-outline', color: '#feca57', feature: 'study-notes' },
       // { name: 'Psychology', icon: 'bulb-outline', color: '#ff9ff3',  feature: 'study-notes' },
    ];

    const [modalVisible, setModalVisible] = useState(false);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [geminiResponse, setGeminiResponse] = useState<string | null>(null);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [showAllTools, setShowAllTools] = useState(false);
    const [showAllSubjects, setShowAllSubjects] = useState(false);
    const [pendingFeature, setPendingFeature] = useState<string | null>(null);
    const [pendingHistoryId, setPendingHistoryId] = useState<number | null>(null);
    const [noteTitle, setNoteTitle] = useState<string>("");
    const [noteContent, setNoteContent] = useState<string>("");
    const [savingNote, setSavingNote] = useState(false);
    const [showPickerModal, setShowPickerModal] = useState(false);

    // Display logic for tools and subjects
    const displayedTools = showAllTools ? allTools : allTools.slice(0, 6);
    const displayedSubjects = showAllSubjects ? allSubjects : allSubjects.slice(0, 4);

    const featureRouteMap: Record<string, string> = {
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
        showImagePickerOptions(feature);
      }
    };

    const showImagePickerOptions = (feature: string) => {
        setPendingFeature(feature);
        setShowPickerModal(true);
    };

    const handleScan = async (feature: string) => {
        setShowPickerModal(false);
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
            alert("Camera permission is required to scan images!");
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 1,
            
        });
        if (!result.canceled && result.assets) {
            setImageUri(result.assets[0].uri);
            setModalVisible(true);
            await processSelectedImage(result.assets[0].uri, feature);
        }
    };

    const handleGallery = async (feature: string) => {
        setShowPickerModal(false);
        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 1,
            
        });
        if (!result.canceled && result.assets) {
            setImageUri(result.assets[0].uri);
            setModalVisible(true);
            await processSelectedImage(result.assets[0].uri, feature);
        }
    };

    const processSelectedImage = async (uri: string, feature: string) => {
        setIsLoading(true);
        setError(null);
        setGeminiResponse(null);
        setExtractedText(null);
        setPendingFeature(feature);
        setNoteTitle("");
        setNoteContent("");

        try {
            setLoadingMessage('Scanning image... (1 credit)');
            const hasEnoughCredits = await spendCredits(1);
            if (!hasEnoughCredits) {
                setError("Not enough credits to scan image. You need at least 1 credit.");
                setIsLoading(false);
                return;
            }

            const text = await processImage(uri);
            setExtractedText(text);

            if (feature === 'study-notes') {
                // Pre-fill note title and content
                setNoteTitle('My Study Note');
                setNoteContent(text);
            } else {
                // Create a history entry for the scan
                const newHistoryId = await addHistory(uri, feature, text, "");
                setPendingHistoryId(newHistoryId);
            }

        } catch (e: any) {
            setError(e.message || 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const getAIAnswer = async () => {
        if (!extractedText || !imageUri || !pendingFeature || !pendingHistoryId) {
            setError(
        "Cannot get answer. Missing text, image, feature, or history context."
      );
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            setLoadingMessage('Generating answer... (1 credit)');
            const hasEnoughCredits = await spendCredits(1);
            if (!hasEnoughCredits) {
                setError("Not enough credits for an answer. You need 1 more credit.");
                setIsLoading(false);
                return;
            }

            const answer = await getAnswerFromGemini(extractedText, pendingFeature);
            setGeminiResponse(answer);

            await updateHistoryAnswer(pendingHistoryId, answer);

        } catch (e: any) {
            setError(e.message || 'Something went wrong. Please try again.');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleSaveNote = async () => {
        if (!noteTitle.trim() || !noteContent.trim()) {
            setError("Note title and content cannot be empty.");
            return;
        }
        setSavingNote(true);
        setError(null);
        try {
            const noteId = await addNote(noteTitle.trim(), noteContent.trim());
            await addHistory('', 'notes', noteTitle.trim(), noteContent.trim());
            setModalVisible(false);
            setNoteTitle("");
            setNoteContent("");
            setExtractedText(null);
        } catch (e: any) {
            setError(e.message || 'Failed to save note.');
        } finally {
            setSavingNote(false);
        }
    };

    const closeModal = () => {
        setModalVisible(false);
        setImageUri(null);
        setError(null);
        setGeminiResponse(null);
        setExtractedText(null);
        setPendingHistoryId(null);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
            
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Good morning! 👋</Text>
                    <Text style={styles.headerTitle}>Ready to learn?</Text>
                </View>
                <TouchableOpacity style={styles.profileButton}>
                    <View style={styles.profileAvatar}>
                        <Ionicons name="person-outline" size={20} color="#667eea" />
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.scrollView} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
               

                {/* Quick Tools */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Quick Tools</Text>
                        <TouchableOpacity onPress={() => setShowAllTools(!showAllTools)}>
                            <Text style={styles.seeAllText}>
                                {showAllTools ? 'Show less' : 'See all'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.toolsGrid}>
                        {displayedTools.map((tool, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={[styles.toolCard, { backgroundColor: tool.bgColor }]}
                                onPress={() => handleToolPress(tool.feature)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.toolIcon, { backgroundColor: tool.color }]}>
                                    <Ionicons name={tool.icon as any} size={20} color="white" />
                                </View>
                                <Text style={styles.toolName}>{tool.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Subjects */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Subjects</Text>
                        <TouchableOpacity onPress={() => setShowAllSubjects(!showAllSubjects)}>
                            <Text style={styles.seeAllText}>
                                {showAllSubjects ? 'Show less' : 'Browse all'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.subjectsContainer}>
                        {displayedSubjects.map((subject, index) => (
                            <TouchableOpacity 
                                key={index} 
                                style={styles.subjectCard}
                                onPress={() => showImagePickerOptions(subject.feature)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.subjectIcon, { backgroundColor: subject.color }]}>
                                    <Ionicons name={subject.icon as any} size={24} color="white" />
                                </View>
                                <View style={styles.subjectInfo}>
                                    <Text style={styles.subjectName}>{subject.name}</Text>
                                    
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#c1c1c1" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

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
                                onPress={() => handleScan(pendingFeature!)}
                            >
                                <Ionicons name="camera-outline" size={24} color="#6366f1" />
                                <Text style={styles.pickerOptionText}>Take Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={styles.pickerOption} 
                                onPress={() => handleGallery(pendingFeature!)}
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

            {/* Enhanced Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.dragHandleContainer}>
                            <View style={styles.dragHandle} />
                        </View>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>AI Solution</Text>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={closeModal}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                        
                        {imageUri && (
                            <Image 
                                source={{ uri: imageUri }} 
                                style={styles.modalImage} 
                                resizeMode="contain"
                            />
                        )}
                        
                        <View style={styles.modalContent}>
                            {isLoading && (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#667eea" />
                                    <Text style={styles.loadingText}>{loadingMessage}</Text>
                                </View>
                            )}
                            
                            {error && !isLoading && (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle" size={24} color="#ff6b6b" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                            {/* Study Notes Special Flow */}
                            {!isLoading && !error && extractedText && pendingFeature === 'study-notes' && (
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionTitle}>Create Study Note</Text>
                                    <Text style={styles.inputLabel}>Title</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={noteTitle}
                                        onChangeText={setNoteTitle}
                                        placeholder="Enter note title"
                                    />
                                    <Text style={styles.inputLabel}>Content</Text>
                                    <ScrollView style={styles.extractedTextView}>
                                        <TextInput
                                            style={[styles.extractedTextContent, { minHeight: 120 }]}
                                            value={noteContent}
                                            onChangeText={setNoteContent}
                                            placeholder="Enter note content"
                                            multiline
                                        />
                                    </ScrollView>
                                    <TouchableOpacity
                                        style={styles.getAnswerButton}
                                        onPress={handleSaveNote}
                                        disabled={savingNote}
                                    >
                                        {savingNote ? (
                                            <ActivityIndicator color="white" />
                                        ) : (
                                            <Ionicons name="save-outline" size={20} color="white" style={{ marginRight: 8 }}/>
                                        )}
                                        <Text style={styles.getAnswerButtonText}>Save Note</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Default AI/Scan Flow */}
                            {!isLoading && !error && extractedText && pendingFeature !== 'study-notes' && !geminiResponse && (
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionTitle}>Extracted Text</Text>
                                    <ScrollView style={styles.extractedTextView}>
                                        <Text style={styles.extractedTextContent}>{extractedText}</Text>
                                    </ScrollView>
                                    <TouchableOpacity style={styles.getAnswerButton} onPress={getAIAnswer}>
                                        <Ionicons name="sparkles-outline" size={20} color="white" style={{ marginRight: 8}}/>
                                        <Text style={styles.getAnswerButtonText}>Get AI Answer (1 Credit)</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            
                            {!isLoading && geminiResponse && (
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sectionTitle}>AI Solution</Text>
                                    <ScrollView 
                                        style={styles.responseContainer}
                                        showsVerticalScrollIndicator={false}
                                    >
                                        <Text style={styles.responseText}>{geminiResponse}</Text>
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: 'white',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: height * 0.85,
        paddingTop: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
    },
    dragHandleContainer: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 10,
    },
    dragHandle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#dcdcdc',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1a1a1a',
    },
    modalCloseButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f8f9fa',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalImage: {
        width: '90%',
        alignSelf: 'center',
        height: 150,
        borderRadius: 16,
        marginBottom: 20,
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffebee',
        padding: 16,
        borderRadius: 12,
        gap: 12,
    },
    errorText: {
        color: '#c62828',
        fontSize: 15,
        fontWeight: '500',
        flex: 1,
    },
    responseContainer: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        padding: 20,
    },
    responseText: {
        fontSize: 15,
        color: '#333',
        lineHeight: 24,
    },
    extractedTextView: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    extractedTextContent: {
        color: '#374151',
        fontSize: 15,
        lineHeight: 22,
    },
    getAnswerButton: {
        backgroundColor: '#22c55e',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
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
    inputLabel: {
        fontWeight: '600',
        color: '#667eea',
        marginTop: 8,
        marginBottom: 4,
        fontSize: 15,
    },
    input: {
        backgroundColor: '#f3f4f6',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#222',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e0e7ef',
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

export default Explore;