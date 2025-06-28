import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import FlashCardGenerationModal from '../components/FlashCardGenerationModal';
import FlashCardViewer from '../components/FlashCardViewer';
import NoteReaderModal from '../components/NoteReaderModal';
import QuizGenerationModal from '../components/QuizGenerationModal';
import { useThemeColor } from '../hooks/useThemeColor';
import { deleteNote, getAllNotes, Note } from '../services/historyStorage';

type QuizType = 'multiple-choice' | 'true-false' | 'fill-blank';

export default function NotesScreen() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [quizModalVisible, setQuizModalVisible] = useState(false);
    const [flashCardModalVisible, setFlashCardModalVisible] = useState(false);
    const [viewerModalVisible, setViewerModalVisible] = useState(false);
    const router = useRouter();

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const cardColor = useThemeColor({}, 'background');
    const borderColor = useThemeColor({}, 'icon');
    const iconColor = useThemeColor({}, 'icon');

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
    };

    const openFlashCardModal = (note: Note) => {
        setSelectedNote(note);
        setFlashCardModalVisible(true);
    };

    const closeQuizModal = () => {
        setQuizModalVisible(false);
        setSelectedNote(null);
    };

    const closeFlashCardModal = () => {
        setFlashCardModalVisible(false);
        setSelectedNote(null);
    };

    const handleQuizSaved = () => {
        // Refresh notes if needed
        loadNotes();
    };

    const handleFlashCardSaved = () => {
        // Refresh notes if needed
        loadNotes();
    };

    const openFlashCardViewer = (note: Note) => {
        setSelectedNote(note);
        setViewerModalVisible(true);
    };

    const closeFlashCardViewer = () => {
        setViewerModalVisible(false);
        setSelectedNote(null);
    };

    const parseFlashCards = (content: string): { front: string; back: string }[] => {
        return content
            .split('---')
            .map(cardBlock => {
                const frontMatch = cardBlock.match(/FRONT:\s*(.*)/);
                const backMatch = cardBlock.match(/BACK:\s*(.*)/);
                if (frontMatch && backMatch) {
                    return { front: frontMatch[1].trim(), back: backMatch[1].trim() };
                }
                return null;
            })
            .filter(Boolean) as { front: string; back: string }[];
    };

    const renderNote = ({ item }: { item: Note }) => (
        <TouchableOpacity 
            style={[styles.noteCard, { backgroundColor: cardColor, borderColor }]}
            onPress={() => openNotePreview(item)}
            activeOpacity={0.7}
        >
            <View style={styles.noteContent}>
                <Text style={[styles.noteTitle, { color: textColor }]}>{item.title}</Text>
                <Text style={[styles.noteExcerpt, { color: iconColor }]} numberOfLines={3}>{item.content}</Text>
                <Text style={[styles.noteDate, { color: iconColor }]}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <View style={styles.noteActions}>
                <TouchableOpacity 
                    style={styles.quizButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        openQuizModal(item);
                    }}
                >
                    <Ionicons name="help-circle-outline" size={20} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.flashCardButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        openFlashCardModal(item);
                    }}
                >
                    <Ionicons name="albums-outline" size={20} color={iconColor} />
                </TouchableOpacity>
                <TouchableOpacity 
                    style={styles.practiceButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        openFlashCardViewer(item);
                    }}
                >
                    <Ionicons name="play-outline" size={20} color="#10b981" />
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
        <View style={[styles.container, { backgroundColor }]}>
            <View style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}>
                <Text style={[styles.headerTitle, { color: textColor }]}>My Notes</Text>
                <View style={[styles.searchContainer, { backgroundColor: cardColor }]}>
                    <Ionicons
                        name="search-outline"
                        size={20}
                        color={iconColor}
                        style={styles.searchIcon}
                    />
                    <TextInput
                        style={[styles.searchInput, { color: textColor }]}
                        placeholder="Search notes..."
                        placeholderTextColor={iconColor}
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
                        <Ionicons name="journal-outline" size={64} color={iconColor} />
                        <Text style={[styles.emptyText, { color: iconColor }]}>
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

            {/* Shared Quiz Generation Modal */}
            <QuizGenerationModal
                visible={quizModalVisible}
                onClose={closeQuizModal}
                sourceContent={selectedNote?.content || ''}
                sourceTitle={selectedNote?.title || ''}
                sourceId={selectedNote?.id}
                sourceType="note"
                onQuizSaved={handleQuizSaved}
            />

            {/* Shared Flash Card Generation Modal */}
            <FlashCardGenerationModal
                visible={flashCardModalVisible}
                onClose={closeFlashCardModal}
                sourceContent={selectedNote?.content || ''}
                sourceTitle={selectedNote?.title || ''}
                sourceId={selectedNote?.id}
                sourceType="note"
                onFlashCardSaved={handleFlashCardSaved}
            />

            {/* Flash Card Viewer Modal */}
            <FlashCardViewer
                visible={viewerModalVisible}
                onClose={closeFlashCardViewer}
                cards={selectedNote ? parseFlashCards(selectedNote.content) : []}
                title={selectedNote?.title || ''}
            />
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
    flashCardButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f0fff4',
    },
    practiceButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#f0fff4',
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
});
