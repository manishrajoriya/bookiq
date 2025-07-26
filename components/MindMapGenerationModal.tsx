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
import { generateMindMapFromNotes } from '../services/geminiServices';
import { addHistory, addMindMap } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

interface MindMapGenerationModalProps {
    visible: boolean;
    onClose: () => void;
    sourceContent: string;
    sourceTitle: string;
    sourceId?: number;
    sourceType?: 'note' | 'scan-note';
    onMindMapSaved?: () => void;
}

interface MindMapState {
    isGenerating: boolean;
    progress: number;
}

export default function MindMapGenerationModal({
    visible,
    onClose,
    sourceContent,
    sourceTitle,
    sourceId,
    sourceType = 'note',
    onMindMapSaved
}: MindMapGenerationModalProps) {
    const router = useRouter();
    const [generatedMindMap, setGeneratedMindMap] = useState<any>(null);
    const [mindMapState, setMindMapState] = useState<MindMapState>({
        isGenerating: false,
        progress: 0
    });

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({}, 'icon');
    const iconColor = useThemeColor({}, 'icon');

    const closeModal = () => {
        if (mindMapState.isGenerating) {
            Alert.alert(
                'Generation in Progress',
                'Please wait for the mind map generation to complete.',
                [{ text: 'OK' }]
            );
            return;
        }
        onClose();
        setGeneratedMindMap(null);
        setMindMapState({ isGenerating: false, progress: 0 });
    };

    const generateMindMap = async () => {
        try {
            setMindMapState(prev => ({ ...prev, isGenerating: true }));

            const creditResult = await subscriptionService.spendCredits(2);
            if (!creditResult.success) {
                Alert.alert(
                    "Out of Credits",
                    creditResult.error || "You need at least 2 credits to generate a mind map.",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Get Credits", onPress: () => router.push('/paywall') }
                    ]
                );
                return;
            }

            setMindMapState(prev => ({ ...prev, progress: 30 }));

            const mindMap = await generateMindMapFromNotes(sourceContent);

            setMindMapState(prev => ({ ...prev, progress: 80 }));

            setGeneratedMindMap(mindMap);
            setMindMapState(prev => ({ ...prev, progress: 100 }));

            // Add to history - convert object to string for storage
            const mindMapString = JSON.stringify(mindMap);
            await addHistory('', 'mind-maps', sourceTitle, mindMapString);

        } catch (error) {
            console.error('Mind map generation error:', error);
            Alert.alert('Error', 'Failed to generate mind map. Please try again.');
        } finally {
            setMindMapState(prev => ({ ...prev, isGenerating: false, progress: 0 }));
        }
    };

    const saveGeneratedMindMap = async () => {
        if (!generatedMindMap) return;

        try {
            const mindMapTitle = `${sourceTitle} - Mind Map`;
            // Convert object to string for storage
            const mindMapString = JSON.stringify(generatedMindMap);
            await addMindMap(
                mindMapTitle,
                mindMapString,
                sourceId,
                sourceType
            );

            Alert.alert(
                'Success!', 
                'Mind map has been saved successfully.',
                [{ text: 'OK' }]
            );

            if (onMindMapSaved) {
                onMindMapSaved();
            }

            closeModal();
        } catch (error) {
            console.error('Failed to save mind map:', error);
            Alert.alert('Error', 'Failed to save mind map. Please try again.');
        }
    };

    const renderMindMapProgress = () => {
        if (!mindMapState.isGenerating) return null;
        return (
            <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                    <Ionicons name="git-network-outline" size={24} color="#96ceb4" />
                    <Text style={[styles.progressTitle, { color: textColor }]}>Generating Mind Map...</Text>
                </View>
                <View style={styles.progressBarContainer}>
                    <View 
                        style={[
                            styles.progressBar,
                            { width: `${mindMapState.progress}%` }
                        ]} 
                    />
                </View>
                <Text style={[styles.progressText, { color: textColor }]}>{mindMapState.progress}% complete</Text>
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
                            <Text style={[styles.modalTitle, { color: textColor }]}>Generate Mind Map</Text>
                            <TouchableOpacity 
                                onPress={closeModal}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color={iconColor} />
                            </TouchableOpacity>
                        </View>
                        <Text style={[styles.selectedNoteTitle, { color: iconColor }]}>From: {sourceTitle}</Text>
                    </View>

                    <ScrollView 
                        style={styles.modalContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Generate Button */}
                        {!generatedMindMap && (
                            <TouchableOpacity
                                style={[
                                    styles.generateButton,
                                    mindMapState.isGenerating && styles.generateButtonDisabled
                                ]}
                                onPress={generateMindMap}
                                disabled={mindMapState.isGenerating}
                            >
                                {mindMapState.isGenerating ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="git-network-outline" size={20} color="white" />
                                        <Text style={styles.generateButtonText}>Generate Mind Map</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}

                        {/* Progress Indicator */}
                        {renderMindMapProgress()}

                        {/* Generated Mind Map */}
                        {generatedMindMap && (
                            <View style={styles.mindMapSection}>
                                <Text style={[styles.sectionTitle, { color: textColor }]}>Generated Mind Map</Text>
                                <View style={[styles.mindMapContent, { backgroundColor: '#f8f9fa', borderColor: '#e5e7eb' }]}> 
                                    <Text style={[styles.mindMapText, { color: '#374151' }]}>
                                        <Text style={{ fontWeight: 'bold' }}>Root: </Text>{generatedMindMap.root}
                                    </Text>
                                    {generatedMindMap.nodes && generatedMindMap.nodes.length > 0 && (
                                        <View style={{ marginTop: 12 }}>
                                            <Text style={[styles.mindMapText, { color: '#374151', fontWeight: 'bold' }]}>Main Topics:</Text>
                                            {generatedMindMap.nodes.map((node: any, index: number) => (
                                                <Text key={index} style={[styles.mindMapText, { color: '#374151', marginLeft: 16 }]}>
                                                    • {node.label}
                                                </Text>
                                            ))}
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={saveGeneratedMindMap}
                                >
                                    <Ionicons name="save-outline" size={20} color="white" />
                                    <Text style={styles.saveButtonText}>Save Mind Map</Text>
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
        backgroundColor: '#96ceb4',
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
        backgroundColor: '#96ceb4',
        borderRadius: 2,
    },
    progressText: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
    },
    mindMapSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16,
    },
    mindMapContent: {
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
    },
    mindMapText: {
        fontSize: 14,
        lineHeight: 22,
    },
    saveButton: {
        backgroundColor: '#96ceb4',
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