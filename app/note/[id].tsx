import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '../../hooks/useThemeColor';
import { addHistory, addNote, getNoteById, getQuizById, getScanNoteById, updateHistoryNote, updateNote, updateQuiz, updateScanNote } from '../../services/historyStorage';

export default function NoteDetailScreen() {
    const { id, isQuiz: isQuizParam } = useLocalSearchParams<{ id: string, isQuiz?: string }>();
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isScanNote, setIsScanNote] = useState(false);
    const isNew = id === 'new';
    const isQuiz = isQuizParam === 'true';

    // Theme colors
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const borderColor = useThemeColor({}, 'icon');
    const iconColor = useThemeColor({}, 'icon');
    const cardColor = useThemeColor({}, 'background');

    useEffect(() => {
        if (!isNew) {
            const loadNote = async () => {
                if (isQuiz) {
                    const quiz = await getQuizById(Number(id));
                    if (quiz) {
                        setTitle(quiz.title);
                        setContent(quiz.content);
                    }
                } else {
                    let note = await getScanNoteById(Number(id));
                    if (note) {
                        setIsScanNote(true);
                        setTitle(note.title);
                        setContent(note.content);
                    } else {
                        note = await getNoteById(Number(id));
                        if (note) {
                            setIsScanNote(false);
                            setTitle(note.title);
                            setContent(note.content);
                        }
                    }
                }
            };
            loadNote();
        }
    }, [id, isNew, isQuiz]);

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert("Title Required", "Please enter a title for your note.");
            return;
        }
        try {
            if (isNew) {
                const newNoteId = await addNote(title, content);
                await addHistory('', 'notes', title, content); 
            } else {
                if (isQuiz) {
                    await updateQuiz(Number(id), title, content);
                    await addHistory('', 'quiz-updated', title, content);
                } else if (isScanNote) {
                    await updateScanNote(Number(id), title, content);
                    await addHistory('', 'scan-notes-updated', title, content);
                } else {
                    await updateNote(Number(id), title, content);
                    await updateHistoryNote(Number(id), title, content);
                }
            }
            router.back();
        } catch (error) {
            console.error("NOTE_DETAIL: Error in handleSave:", error);
            Alert.alert("Error", "There was an error saving your note. Please try again.");
        }
    };

    return (
        <KeyboardAvoidingView 
            style={[styles.container, { backgroundColor }]} 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={[styles.header, { borderBottomColor: borderColor, backgroundColor }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color={iconColor} />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={[styles.headerTitle, { color: textColor }]}>
                        {isNew ? 'New Note' : isQuiz ? 'Edit Quiz' : isScanNote ? 'Edit Scan Note' : 'Edit Note'}
                    </Text>
                    {!isNew && isScanNote && (
                        <View style={[styles.scanNoteIndicator, { borderColor: iconColor }]}>
                            <Ionicons name="scan-outline" size={12} color={iconColor} />
                            <Text style={[styles.scanNoteText, { color: iconColor }]}>Scan Note</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity style={[styles.saveButton, { backgroundColor: iconColor }]} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <TextInput
                    style={[styles.titleInput, { color: textColor, borderBottomColor: borderColor }]}
                    placeholder="Title"
                    placeholderTextColor={iconColor}
                    value={title}
                    onChangeText={setTitle}
                />
                <TextInput
                    style={[styles.contentInput, { color: textColor }]}
                    placeholder={isQuiz ? "Edit your quiz questions and answers here..." : "Start writing your note here..."}
                    placeholderTextColor={iconColor}
                    value={content}
                    onChangeText={setContent}
                    multiline
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // backgroundColor: 'white', // replaced by theme
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 16,
        borderBottomWidth: 1,
        // borderBottomColor: '#f0f0f0', // replaced by theme
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        // color replaced by theme
    },
    scanNoteIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        padding: 4,
        borderWidth: 1,
        // borderColor: '#6366f1', // replaced by theme
        borderRadius: 4,
    },
    scanNoteText: {
        fontSize: 12,
        fontWeight: 'bold',
        // color: '#6366f1', // replaced by theme
        marginLeft: 4,
    },
    saveButton: {
        // backgroundColor: '#667eea', // replaced by theme
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    scrollContainer: {
        padding: 16,
    },
    titleInput: {
        fontSize: 24,
        fontWeight: 'bold',
        paddingBottom: 16,
        borderBottomWidth: 1,
        // borderBottomColor: '#f0f0f0', // replaced by theme
        marginBottom: 16,
        // color replaced by theme
    },
    contentInput: {
        flex: 1,
        fontSize: 18,
        lineHeight: 28,
        textAlignVertical: 'top',
        // color replaced by theme
    },
}); 