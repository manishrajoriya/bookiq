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
import { generateEnhancedNotes } from '../services/geminiServices';

interface EnhanceNotesModalProps {
    visible: boolean;
    onClose: () => void;
    sourceContent: string;
    sourceTitle: string;
    sourceId?: number;
    onNoteEnhanced?: (enhancedContent: string) => void;
}

interface EnhanceState {
    isEnhancing: boolean;
    progress: number;
}

export default function EnhanceNotesModal({
    visible,
    onClose,
    sourceContent,
    sourceTitle,
    sourceId,
    onNoteEnhanced
}: EnhanceNotesModalProps) {
    const router = useRouter();
    const [enhancedNotes, setEnhancedNotes] = useState<string>('');
    const [enhanceState, setEnhanceState] = useState<EnhanceState>({
        isEnhancing: false,
        progress: 0
    });
    const [error, setError] = useState<string | null>(null);

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({}, 'icon');
    const iconColor = useThemeColor({}, 'icon');

    const closeModal = () => {
        if (enhanceState.isEnhancing) {
            Alert.alert(
                'Enhancement in Progress',
                'Please wait for the enhancement to complete.',
                [{ text: 'OK' }]
            );
            return;
        }
        onClose();
        setEnhancedNotes('');
        setEnhanceState({ isEnhancing: false, progress: 0 });
        setError(null);
    };

    const enhanceNotes = async () => {
        try {
            setEnhanceState(prev => ({ ...prev, isEnhancing: true, progress: 10 }));
            setError(null);

            setEnhanceState(prev => ({ ...prev, progress: 30 }));
            const enhanced = await generateEnhancedNotes(sourceContent);
            setEnhanceState(prev => ({ ...prev, progress: 80 }));
            setEnhancedNotes(enhanced);
            setEnhanceState(prev => ({ ...prev, progress: 100 }));
        } catch (err: any) {
            setError(err.message || 'Failed to enhance notes. Please try again.');
        } finally {
            setEnhanceState(prev => ({ ...prev, isEnhancing: false, progress: 0 }));
        }
    };

    const saveEnhancedNotes = async () => {
        if (!enhancedNotes) return;
        try {
            Alert.alert('Success!', 'Enhanced notes are ready.', [{ text: 'OK' }]);
            if (onNoteEnhanced) {
                onNoteEnhanced(enhancedNotes);
            }
            closeModal();
        } catch (err) {
            setError('Failed to save enhanced notes.');
        }
    };

    const renderEnhanceProgress = () => {
        if (!enhanceState.isEnhancing) return null;
        return (
            <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                    <Ionicons name="sparkles-outline" size={24} color="#667eea" />
                    <Text style={[styles.progressTitle, { color: textColor }]}>Enhancing Notes...</Text>
                </View>
                <View style={styles.progressBarContainer}>
                    <View 
                        style={[
                            styles.progressBar,
                            { width: `${enhanceState.progress}%` }
                        ]} 
                    />
                </View>
                <Text style={[styles.progressText, { color: textColor }]}>{enhanceState.progress}% complete</Text>
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
                            <Text style={[styles.modalTitle, { color: textColor }]}>Enhance Notes</Text>
                            <TouchableOpacity 
                                onPress={closeModal}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color={iconColor} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.selectedNoteTitle, { color: iconColor }]}>From: {sourceTitle}</Text>
                    </View>

                    <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                        {/* Enhance Button */}
                        {!enhancedNotes && !error && (
                            <TouchableOpacity
                                style={[styles.generateButton, enhanceState.isEnhancing && styles.generateButtonDisabled]}
                                onPress={enhanceNotes}
                                disabled={enhanceState.isEnhancing}
                            >
                                {enhanceState.isEnhancing ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="sparkles-outline" size={20} color="white" />
                                        <Text style={styles.generateButtonText}>Enhance Notes</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                        {/* Progress Indicator */}
                        {renderEnhanceProgress()}
                        {/* Error */}
                        {error && (
                            <View style={styles.errorContainer}>
                                <Ionicons name="alert-circle" size={20} color="#ff6b6b" />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
                        {/* Enhanced Notes Preview */}
                        {enhancedNotes && (
                            <View style={styles.quizSection}>
                                <Text style={[styles.sectionTitle, { color: textColor }]}>Enhanced Notes</Text>
                                <View style={[styles.quizContent, { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }]}> 
                                    <Text style={[styles.quizText, { color: '#374151' }]}>{enhancedNotes}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={saveEnhancedNotes}
                                >
                                    <Ionicons name="save-outline" size={20} color="white" />
                                    <Text style={styles.saveButtonText}>Save Enhanced Notes</Text>
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
    generateButton: {
        backgroundColor: '#667eea',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 24,
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
        marginTop: 24,
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
        backgroundColor: '#667eea',
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
        backgroundColor: '#667eea',
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff3cd',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#ffeeba',
    },
    errorText: {
        color: '#856404',
        fontSize: 14,
        marginLeft: 10,
    },
}); 