import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
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
import NoteReaderModal from '../components/NoteReaderModal';
import { generateQuizFromNotes } from '../services/geminiServices';
import { addQuiz, deleteNote, getAllNotes, Note, spendCredits } from '../services/historyStorage';

type QuizType = 'multiple-choice' | 'true-false' | 'fill-blank';

export default function NotesScreen() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [quizModalVisible, setQuizModalVisible] = useState(false);
    const [generatedQuiz, setGeneratedQuiz] = useState<string>('');
    const [selectedQuizType, setSelectedQuizType] = useState<QuizType>('multiple-choice');
    const [numberOfQuestions, setNumberOfQuestions] = useState<number>(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const router = useRouter();

    const loadNotes = useCallback(async () => {
        const allNotes = await getAllNotes();
        setNotes(allNotes);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadNotes();
        }, [loadNotes])
    );

    const filteredNotes = useMemo(() => {
        return notes.filter(
            (note) =>
                note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                note.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [notes, searchQuery]);

    const handleDelete = (id: number) => {
        Alert.alert(
            "Delete Note",
            "Are you sure you want to delete this note?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await deleteNote(id);
                        loadNotes(); // Refresh list
                    },
                },
            ]
        );
    };

    const openNotePreview = (note: Note) => {
        setSelectedNote(note);
        setPreviewModalVisible(true);
    };

    const openQuizModal = (note: Note) => {
        setSelectedNote(note);
        setQuizModalVisible(true);
        setGeneratedQuiz('');
    };

    const closeQuizModal = () => {
        if (isGenerating) {
            Alert.alert(
                'Generation in Progress',
                'Please wait for the quiz generation to complete.',
                [{ text: 'OK' }]
            );
            return;
        }
        setQuizModalVisible(false);
        setSelectedNote(null);
        setGeneratedQuiz('');
    };

    const generateQuiz = async () => {
        if (!selectedNote) return;

        try {
            setIsGenerating(true);

            const hasEnoughCredits = await spendCredits(2);
            if (!hasEnoughCredits) {
                Alert.alert('Insufficient Credits', 'You need 2 credits to generate a quiz.');
                return;
            }

            const quiz = await generateQuizFromNotes(
                selectedNote.content,
                selectedQuizType,
                numberOfQuestions
            );

            setGeneratedQuiz(quiz);

        } catch (error) {
            console.error('Quiz generation error:', error);
            Alert.alert('Error', 'Failed to generate quiz. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const saveGeneratedQuiz = async () => {
        if (!generatedQuiz || !selectedNote) return;

        try {
            const quizTitle = `${selectedNote.title} - ${selectedQuizType.replace('-', ' ')} Quiz`;
            
            await addQuiz(
                quizTitle,
                generatedQuiz,
                selectedQuizType,
                numberOfQuestions,
                selectedNote.id,
                'note'
            );

            Alert.alert(
                'Success!', 
                'Quiz has been saved successfully.',
                [{ text: 'OK' }]
            );
            
            closeQuizModal();
        } catch (error) {
            console.error('Failed to save quiz:', error);
            Alert.alert('Error', 'Failed to save quiz. Please try again.');
        }
    };

    const renderNote = ({ item }: { item: Note }) => (
        <TouchableOpacity 
            style={styles.noteCard} 
            onPress={() => openNotePreview(item)}
            activeOpacity={0.7}
        >
            <View style={styles.noteContent}>
                <Text style={styles.noteTitle}>{item.title}</Text>
                <Text style={styles.noteExcerpt} numberOfLines={3}>{item.content}</Text>
                <Text style={styles.noteDate}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <View style={styles.noteActions}>
                <TouchableOpacity 
                    style={styles.quizButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        openQuizModal(item);
                    }}
                >
                    <Ionicons name="help-circle-outline" size={20} color="#f093fb" />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                    }} 
                    style={styles.deleteButton}
                >
                    <Ionicons name="trash-outline" size={22} color="#ff6b6b" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>My Notes</Text>
                <View style={styles.searchContainer}>
                    <Ionicons
                        name="search-outline"
                        size={20}
                        color="#9ca3af"
                        style={styles.searchIcon}
                    />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search notes..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>
            <FlatList
                data={filteredNotes}
                renderItem={renderNote}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="journal-outline" size={64} color="#e5e7eb" />
                        <Text style={styles.emptyText}>
                            {searchQuery
                                ? "No notes found."
                                : "No notes yet. Tap the '+' button to create one!"}
                        </Text>
                    </View>
                }
            />
            <TouchableOpacity
                style={styles.fab}
                onPress={() => router.push("/note/new" as any)}
            >
                <Ionicons name="add" size={32} color="white" />
            </TouchableOpacity>

            {/* Full Screen Note Preview Modal */}
            <NoteReaderModal
                visible={previewModalVisible}
                onClose={() => setPreviewModalVisible(false)}
                note={selectedNote}
            />

            {/* Quiz Generation Modal */}
            <Modal
                visible={quizModalVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={closeQuizModal}
            >
                <SafeAreaView style={styles.modalSafeAreView}>
                    <View style={styles.modalContainer}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <View style={styles.modalTitleContainer}>
                                <Text style={styles.modalTitle}>Generate Quiz</Text>
                                <TouchableOpacity 
                                    onPress={closeQuizModal}
                                    style={styles.closeButton}
                                >
                                    <Ionicons name="close" size={24} color="#6b7280" />
                                </TouchableOpacity>
                            </View>
                            {selectedNote && (
                                <Text style={styles.selectedNoteTitle}>
                                    From: {selectedNote.title}
                                </Text>
                            )}
                        </View>

                        <ScrollView 
                            style={styles.modalContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Quiz Settings */}
                            {!generatedQuiz && (
                                <View style={styles.settingsSection}>
                                    <Text style={styles.sectionTitle}>Quiz Settings</Text>
                                    
                                    <View style={styles.settingGroup}>
                                        <Text style={styles.settingLabel}>Quiz Type</Text>
                                        <View style={styles.quizTypeButtons}>
                                            {(['multiple-choice', 'true-false', 'fill-blank'] as QuizType[]).map((type) => (
                                                <TouchableOpacity
                                                    key={type}
                                                    style={[
                                                        styles.quizTypeButton,
                                                        selectedQuizType === type && styles.quizTypeButtonActive
                                                    ]}
                                                    onPress={() => setSelectedQuizType(type)}
                                                >
                                                    <Text style={[
                                                        styles.quizTypeButtonText,
                                                        selectedQuizType === type && styles.quizTypeButtonTextActive
                                                    ]}>
                                                        {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    <View style={styles.settingGroup}>
                                        <Text style={styles.settingLabel}>Number of Questions</Text>
                                        <View style={styles.questionCountButtons}>
                                            {[3, 5, 10, 15].map((count) => (
                                                <TouchableOpacity
                                                    key={count}
                                                    style={[
                                                        styles.questionCountButton,
                                                        numberOfQuestions === count && styles.questionCountButtonActive
                                                    ]}
                                                    onPress={() => setNumberOfQuestions(count)}
                                                >
                                                    <Text style={[
                                                        styles.questionCountButtonText,
                                                        numberOfQuestions === count && styles.questionCountButtonTextActive
                                                    ]}>
                                                        {count}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[
                                            styles.generateButton,
                                            isGenerating && styles.generateButtonDisabled
                                        ]}
                                        onPress={generateQuiz}
                                        disabled={isGenerating}
                                    >
                                        {isGenerating ? (
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

                            {/* Generated Quiz */}
                            {generatedQuiz && (
                                <View style={styles.quizSection}>
                                    <Text style={styles.sectionTitle}>Generated Quiz</Text>
                                    <View style={styles.quizContent}>
                                        <Text style={styles.quizText}>{generatedQuiz}</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6'
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: '#111827',
    },
    listContainer: {
        padding: 16,
        paddingBottom: 100, // To avoid FAB overlap
    },
    noteCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        flexDirection: 'row',
        shadowColor: '#111827',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
    },
    noteContent: {
        flex: 1,
    },
    noteTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
    },
    noteExcerpt: {
        fontSize: 14,
        color: '#4b5563',
        lineHeight: 20,
        marginBottom: 12,
    },
    noteDate: {
        fontSize: 12,
        color: '#9ca3af',
    },
    noteActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    quizButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f0f0ff',
    },
    deleteButton: {
        padding: 8,
        justifyContent: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: '#9ca3af',
        textAlign: 'center',
        paddingHorizontal: 32,
    },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#6366f1',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#6366f1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    // Modal styles
    modalSafeAreView: {
        flex: 1,
        backgroundColor: 'white'
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'white',
    },
    modalHeader: {
        paddingTop: Platform.OS === 'ios' ? 12 : 28,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
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
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    selectedNoteTitle: {
        fontSize: 14,
        color: '#6b7280',
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
        color: '#111827',
        marginBottom: 16,
    },
    settingGroup: {
        marginBottom: 24,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    quizTypeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    quizTypeButton: {
        flex: 1,
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    quizTypeButtonActive: {
        backgroundColor: '#f093fb',
        borderColor: '#f093fb',
    },
    quizTypeButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4b5563',
    },
    quizTypeButtonTextActive: {
        color: 'white',
    },
    questionCountButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    questionCountButton: {
        flex: 1,
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    questionCountButtonActive: {
        backgroundColor: '#f093fb',
        borderColor: '#f093fb',
    },
    questionCountButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4b5563',
    },
    questionCountButtonTextActive: {
        color: 'white',
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
    quizSection: {
        marginBottom: 24,
    },
    quizContent: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    quizText: {
        fontSize: 14,
        color: '#374151',
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
