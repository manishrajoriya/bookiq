import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    Animated,
    FlatList,
    Platform,
    SafeAreaView,
    StatusBar,
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
import { useThemeContext } from '../providers/ThemeProvider';
import { deleteNote, getAllNotes, Note } from '../services/historyStorage';

// Dynamic color scheme based on theme
const getColors = (isDark: boolean) => ({
  primary: '#feca57',
  secondary: '#feca57',
  accentColor: '#feca57',
  dangerColor: '#ff6b6b',
  successColor: '#43e97b',
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

export default function NotesScreen() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [quizModalVisible, setQuizModalVisible] = useState(false);
    const [flashCardModalVisible, setFlashCardModalVisible] = useState(false);
    const [viewerModalVisible, setViewerModalVisible] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const router = useRouter();

    // Theme context
    const { resolvedTheme } = useThemeContext();
    const COLORS = getColors(resolvedTheme === 'dark');

    // Animation values
    const searchAnim = React.useRef(new Animated.Value(0)).current;
    const fadeAnim = React.useRef(new Animated.Value(1)).current;

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
                        loadNotes();
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
        loadNotes();
    };

    const handleFlashCardSaved = () => {
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

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
        
        if (diffInHours < 24) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffInHours < 168) { // 7 days
            return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getWordCount = (content: string) => {
        return content.split(/\s+/).filter(word => word.length > 0).length;
    };

    const handleSearchFocus = () => {
        setIsSearchFocused(true);
        Animated.timing(searchAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
        }).start();
    };

    const handleSearchBlur = () => {
        setIsSearchFocused(false);
        Animated.timing(searchAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: false,
        }).start();
    };

    const renderNote = ({ item, index }: { item: Note; index: number }) => {
        const wordCount = getWordCount(item.content);
        const hasFlashCards = item.content.includes('FRONT:') && item.content.includes('BACK:');
        
        return (
            <Animated.View
                style={[
                    styles.noteCard,
                    { 
                        backgroundColor: COLORS.cardColor, 
                        borderColor: COLORS.borderColor,
                        transform: [{ scale: fadeAnim }]
                    }
                ]}
            >
                <TouchableOpacity 
                    style={styles.noteContent}
                    onPress={() => openNotePreview(item)}
                    activeOpacity={0.7}
                >
                    <View style={styles.noteHeader}>
                        <View style={styles.noteTitleContainer}>
                            <Text style={[styles.noteTitle, { color: COLORS.textColor.primary }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            {hasFlashCards && (
                                <View style={[styles.flashCardBadge, { backgroundColor: COLORS.successColor }]}>
                                    <Ionicons name="albums" size={12} color={COLORS.textColor.white} />
                                </View>
                            )}
                        </View>
                        <Text style={[styles.noteDate, { color: COLORS.textColor.light }]}>
                            {formatDate(item.createdAt)}
                        </Text>
                    </View>
                    
                    <Text style={[styles.noteExcerpt, { color: COLORS.textColor.secondary }]} numberOfLines={2}>
                        {item.content}
                    </Text>
                    
                    <View style={styles.noteFooter}>
                        <View style={styles.noteStats}>
                            <View style={[styles.statItem, { backgroundColor: COLORS.backgroundColor }]}>
                                <Ionicons name="document-text" size={14} color={COLORS.accentColor} />
                                <Text style={[styles.statText, { color: COLORS.textColor.secondary }]}>
                                    {wordCount} words
                                </Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>
                
                <View style={styles.noteActions}>
                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
                        onPress={() => openQuizModal(item)}
                    >
                        <Ionicons name="help-circle" size={18} color={COLORS.accentColor} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
                        onPress={() => openFlashCardModal(item)}
                    >
                        <Ionicons name="albums" size={18} color={COLORS.successColor} />
                    </TouchableOpacity>
                    
                    {hasFlashCards && (
                        <TouchableOpacity 
                            style={[styles.actionButton, { backgroundColor: COLORS.successColor }]}
                            onPress={() => openFlashCardViewer(item)}
                        >
                            <Ionicons name="play" size={18} color={COLORS.textColor.white} />
                        </TouchableOpacity>
                    )}
                    
                    <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: COLORS.backgroundColor }]}
                        onPress={() => handleDelete(item.id)}
                    >
                        <Ionicons name="trash" size={18} color={COLORS.dangerColor} />
                    </TouchableOpacity>
                </View>
            </Animated.View>
        );
    };

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: COLORS.backgroundColor }]}>
                <Ionicons name="journal" size={64} color={COLORS.accentColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: COLORS.textColor.primary }]}>
                {searchQuery ? "No notes found" : "No notes yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: COLORS.textColor.secondary }]}>
                {searchQuery 
                    ? "Try adjusting your search terms"
                    : "Create your first note to get started"
                }
            </Text>
            {!searchQuery && (
                <TouchableOpacity
                    style={[styles.createButton, { backgroundColor: COLORS.accentColor }]}
                    onPress={() => router.push("/note/new" as any)}
                >
                    <Ionicons name="add" size={20} color={COLORS.textColor.white} />
                    <Text style={[styles.createButtonText, { color: COLORS.textColor.white }]}>
                        Create Note
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: COLORS.backgroundColor }]}>
            <StatusBar barStyle={resolvedTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={COLORS.headerBackground} />
            
            {/* Header */}
            <View style={[styles.header, { backgroundColor: COLORS.headerBackground, borderBottomColor: COLORS.borderColor }]}>
                <View style={styles.headerContent}>
                    <View style={styles.headerText}>
                        <Text style={[styles.headerTitle, { color: COLORS.textColor.primary }]}>My Notes</Text>
                        <Text style={[styles.headerSubtitle, { color: COLORS.textColor.secondary }]}>
                            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.fab, { backgroundColor: COLORS.accentColor }]}
                        onPress={() => router.push("/note/new" as any)}
                    >
                        <Ionicons name="add" size={24} color={COLORS.textColor.white} />
                    </TouchableOpacity>
                </View>
                
                {/* Search Bar */}
                <Animated.View 
                    style={[
                        styles.searchContainer, 
                        { 
                            backgroundColor: COLORS.cardColor,
                            borderColor: isSearchFocused ? COLORS.accentColor : COLORS.borderColor,
                            transform: [{
                                scale: searchAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [1, 1.02],
                                })
                            }]
                        }
                    ]}
                >
                    <Ionicons
                        name="search"
                        size={20}
                        color={COLORS.textColor.secondary}
                        style={styles.searchIcon}
                    />
                    <TextInput
                        style={[styles.searchInput, { color: COLORS.textColor.primary }]}
                        placeholder="Search notes..."
                        placeholderTextColor={COLORS.textColor.light}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onFocus={handleSearchFocus}
                        onBlur={handleSearchBlur}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery("")}>
                            <Ionicons name="close-circle" size={20} color={COLORS.textColor.secondary} />
                        </TouchableOpacity>
                    )}
                </Animated.View>
            </View>

            {/* Notes List */}
            <FlatList
                data={filteredNotes}
                renderItem={renderNote}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={renderEmptyState()}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />

            {/* Modals */}
            <NoteReaderModal
                visible={previewModalVisible}
                onClose={() => setPreviewModalVisible(false)}
                note={selectedNote}
            />

            <QuizGenerationModal
                visible={quizModalVisible}
                onClose={closeQuizModal}
                sourceContent={selectedNote?.content || ''}
                sourceTitle={selectedNote?.title || ''}
                sourceId={selectedNote?.id}
                sourceType="note"
                onQuizSaved={handleQuizSaved}
            />

            <FlashCardGenerationModal
                visible={flashCardModalVisible}
                onClose={closeFlashCardModal}
                sourceContent={selectedNote?.content || ''}
                sourceTitle={selectedNote?.title || ''}
                sourceId={selectedNote?.id}
                sourceType="note"
                onFlashCardSaved={handleFlashCardSaved}
            />

            <FlashCardViewer
                visible={viewerModalVisible}
                onClose={closeFlashCardViewer}
                cards={selectedNote ? parseFlashCards(selectedNote.content) : []}
                title={selectedNote?.title || ''}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 16,
        fontWeight: '500',
    },
    fab: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    listContainer: {
        padding: 20,
        paddingBottom: 100,
    },
    noteCard: {
        borderRadius: 16,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        overflow: 'hidden',
    },
    noteContent: {
        padding: 20,
    },
    noteHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    noteTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
    },
    noteTitle: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
    },
    flashCardBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 8,
    },
    noteDate: {
        fontSize: 12,
        fontWeight: '500',
    },
    noteExcerpt: {
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 16,
    },
    noteFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    noteStats: {
        flexDirection: 'row',
        gap: 8,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    statText: {
        fontSize: 12,
        fontWeight: '500',
    },
    noteActions: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    actionButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        marginTop: 60,
    },
    emptyIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    createButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
