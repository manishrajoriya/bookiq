import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { addHistory, addNote, getNoteById, getScanNoteById, updateHistoryNote, updateNote, updateScanNote } from '../../services/historyStorage';

export default function NoteDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isScanNote, setIsScanNote] = useState(false);
    const isNew = id === 'new';

    useEffect(() => {
        if (!isNew) {
            const loadNote = async () => {
                // First try to load as a scan note
                let note = await getScanNoteById(Number(id));
                if (note) {
                    setIsScanNote(true);
                    setTitle(note.title);
                    setContent(note.content);
                } else {
                    // If not found in scan notes, try regular notes
                    note = await getNoteById(Number(id));
                    if (note) {
                        setIsScanNote(false);
                        setTitle(note.title);
                        setContent(note.content);
                    }
                }
            };
            loadNote();
        }
    }, [id, isNew]);

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert("Title Required", "Please enter a title for your note.");
            return;
        }
        console.log("NOTE_DETAIL: handleSave called. isNew:", isNew, "isScanNote:", isScanNote);
        try {
            if (isNew) {
                console.log("NOTE_DETAIL: Creating new note with title:", title);
                const newNoteId = await addNote(title, content);
                console.log("NOTE_DETAIL: Note added to 'notes' table. Now adding to 'history' table.");
                await addHistory('', 'notes', title, content); 
                console.log("NOTE_DETAIL: Note also added to history.");
            } else {
                console.log("NOTE_DETAIL: Updating note with id:", id, "isScanNote:", isScanNote);
                if (isScanNote) {
                    await updateScanNote(Number(id), title, content);
                    await addHistory('', 'scan-notes-updated', title, content);
                } else {
                    await updateNote(Number(id), title, content);
                    await updateHistoryNote(Number(id), title, content);
                }
                console.log("NOTE_DETAIL: Note updated and history log created.");
            }
            router.back();
        } catch (error) {
            console.error("NOTE_DETAIL: Error in handleSave:", error);
        }
    };

    return (
        <KeyboardAvoidingView 
            style={styles.container} 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={28} color="#667eea" />
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>
                        {isNew ? 'New Note' : isScanNote ? 'Edit Scan Note' : 'Edit Note'}
                    </Text>
                    {!isNew && isScanNote && (
                        <View style={styles.scanNoteIndicator}>
                            <Ionicons name="scan-outline" size={12} color="#6366f1" />
                            <Text style={styles.scanNoteText}>Scan Note</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContainer}>
                <TextInput
                    style={styles.titleInput}
                    placeholder="Title"
                    value={title}
                    onChangeText={setTitle}
                />
                <TextInput
                    style={styles.contentInput}
                    placeholder="Start writing your note here..."
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
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
    },
    scanNoteIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 8,
        padding: 4,
        borderWidth: 1,
        borderColor: '#6366f1',
        borderRadius: 4,
    },
    scanNoteText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#6366f1',
        marginLeft: 4,
    },
    saveButton: {
        backgroundColor: '#667eea',
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
        borderBottomColor: '#f0f0f0',
        marginBottom: 16,
    },
    contentInput: {
        flex: 1,
        fontSize: 18,
        lineHeight: 28,
        textAlignVertical: 'top'
    },
}); 