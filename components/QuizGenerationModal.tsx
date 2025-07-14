import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { generateQuizFromNotes } from '../services/geminiServices';
import { addHistory, addQuiz } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

type QuizType = 'multiple-choice' | 'true-false' | 'fill-blank';

interface QuizGenerationModalProps {
    visible: boolean;
    onClose: () => void;
    sourceContent: string;
    sourceTitle: string;
    sourceId?: number;
    sourceType?: 'note' | 'scan-note';
    onQuizSaved?: () => void;
}

interface QuizState {
    isGenerating: boolean;
    progress: number;
}

export default function QuizGenerationModal({
    visible,
    onClose,
    sourceContent,
    sourceTitle,
    sourceId,
    sourceType = 'note',
    onQuizSaved
}: QuizGenerationModalProps) {
    const router = useRouter();
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
        if (quizState.isGenerating) {
            Alert.alert(
                'Generation in Progress',
                'Please wait for the quiz generation to complete.',
                [{ text: 'OK' }]
            );
            return;
        }
        onClose();
        setGeneratedQuiz('');
        setQuizState({ isGenerating: false, progress: 0 });
    };

    const generateQuiz = async () => {
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
                sourceContent,
                selectedQuizType
            );

            setQuizState(prev => ({ ...prev, progress: 80 }));

            setGeneratedQuiz(quiz);
            setQuizState(prev => ({ ...prev, progress: 100 }));

            // Add to history
            await addHistory('', 'quiz-maker', sourceTitle, quiz);

        } catch (error) {
            console.error('Quiz generation error:', error);
            Alert.alert('Error', 'Failed to generate quiz. Please try again.');
        } finally {
            setQuizState(prev => ({ ...prev, isGenerating: false, progress: 0 }));
        }
    };

    const saveGeneratedQuiz = async () => {
        if (!generatedQuiz) return;

        try {
            const quizTitle = `${sourceTitle} - ${selectedQuizType.replace('-', ' ')} Quiz`;
            
            await addQuiz(
                quizTitle,
                generatedQuiz,
                selectedQuizType,
                0, // We'll calculate the actual number when parsing
                sourceId,
                sourceType
            );

            Alert.alert(
                'Success!', 
                'Quiz has been saved successfully.',
                [{ text: 'OK' }]
            );
            
            // Call the callback to refresh the parent component
            if (onQuizSaved) {
                onQuizSaved();
            }
            
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
                            <Text style={[styles.modalTitle, { color: textColor }]}>Generate Quiz</Text>
                            <TouchableOpacity 
                                onPress={closeModal}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color={iconColor} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.selectedNoteTitle, { color: iconColor }]}>
                            From: {sourceTitle}
                        </Text>
                    </View>

                    <ScrollView 
                        style={styles.modalContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Quiz Settings */}
                        {!generatedQuiz && (
                            <View style={styles.settingsSection}>
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
                                                    selectedQuizType === type && { backgroundColor: '#f093fb', borderColor: '#f093fb' },
                                                ]}
                                                onPress={() => setSelectedQuizType(type)}
                                            >
                                                <Text style={[
                                                    styles.quizTypeButtonText,
                                                    { color: '#4b5563' },
                                                    selectedQuizType === type && { color: 'white' },
                                                ]}>
                                                    {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[
                                        styles.generateButton,
                                        quizState.isGenerating && styles.generateButtonDisabled
                                    ]}
                                    onPress={generateQuiz}
                                    disabled={quizState.isGenerating}
                                >
                                    {quizState.isGenerating ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="sparkles-outline" size={20} color="white" />
                                            <Text style={styles.generateButtonText}>
                                                Generate Quiz 
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Progress Indicator */}
                        {renderQuizProgress()}

                        {/* Generated Quiz */}
                        {generatedQuiz && (
                            <View style={styles.quizSection}>
                                <Text style={[styles.sectionTitle, { color: textColor }]}>Generated Quiz</Text>
                                <View style={[styles.quizContent, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }]}>
                                    <Text style={[styles.quizText, { color: '#374151' }]}>{generatedQuiz}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={saveGeneratedQuiz}
                                >
                                    <Ionicons name="save-outline" size={20} color="white" />
                                    <Text style={styles.saveButtonText}>Save Quiz</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
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
    selectedNoteTitle: {
        fontSize: 14,
        fontStyle: 'italic',
    },
    modalContent: {
        flex: 1,
        paddingHorizontal: 20,
    },
    settingsSection: {
        marginVertical: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
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
    generateButton: {
        backgroundColor: '#f093fb',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 16,
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
}); 