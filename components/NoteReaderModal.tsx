import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NoteReaderModalProps {
  visible: boolean;
  onClose: () => void;
  note: {
    id: number;
    title: string;
    content: string;
    createdAt: Date | string;
    wordCount?: number;
  } | null;
  isScanNote?: boolean;
}

export default function NoteReaderModal({ 
  visible, 
  onClose, 
  note, 
  isScanNote = false 
}: NoteReaderModalProps) {
  const router = useRouter();

  if (!note) return null;

  const wordCount = note.wordCount || note.content.split(/\s+/).filter(word => word.length > 0).length;
  const createdAt = typeof note.createdAt === 'string' ? new Date(note.createdAt) : note.createdAt;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
    >
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.title} numberOfLines={1}>
              {note.title}
            </Text>
            <View style={styles.meta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color="#6b7280" />
                <Text style={styles.metaText}>
                  {createdAt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="document-text-outline" size={16} color="#6b7280" />
                <Text style={styles.metaText}>
                  {wordCount} words
                </Text>
              </View>
              {isScanNote && (
                <View style={styles.scanBadge}>
                  <Ionicons name="scan-outline" size={12} color="#6366f1" />
                  <Text style={styles.scanText}>Scan Note</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => {
              onClose();
              router.push(`/note/${note.id}` as any);
            }}
          >
            <Ionicons name="create-outline" size={20} color="#6366f1" />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          <Text style={styles.noteText}>
            {note.content}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeButton: {
    padding: 8,
    marginRight: 4,
  },
  headerContent: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 4,
  },
  scanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scanText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366f1',
    marginLeft: 2,
  },
  editButton: {
    padding: 8,
    marginLeft: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  noteText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#374151',
  },
}); 