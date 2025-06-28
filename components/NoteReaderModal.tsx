import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';

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
  isQuiz?: boolean;
}

export default function NoteReaderModal({ 
  visible, 
  onClose, 
  note, 
  isScanNote = false,
  isQuiz = false
}: NoteReaderModalProps) {
  const router = useRouter();
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');
  const cardColor = useThemeColor({}, 'background');

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
      <StatusBar barStyle={backgroundColor === '#fff' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={[styles.header, { borderBottomColor: borderColor, backgroundColor }]}>
          <TouchableOpacity 
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={iconColor} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
              {note.title}
            </Text>
            <View style={styles.meta}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={16} color={iconColor} />
                <Text style={[styles.metaText, { color: iconColor }]}>
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
                <Ionicons name="document-text-outline" size={16} color={iconColor} />
                <Text style={[styles.metaText, { color: iconColor }]}>
                  {wordCount} words
                </Text>
              </View>
              {isScanNote && (
                <View style={[styles.scanBadge, { backgroundColor: cardColor }]}>
                  <Ionicons name="scan-outline" size={12} color={iconColor} />
                  <Text style={[styles.scanText, { color: iconColor }]}>Scan Note</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => {
              onClose();
              if (isQuiz) {
                router.push({ pathname: `/note/${note.id}`, params: { isQuiz: true } } as any);
              } else {
                router.push(`/note/${note.id}` as any);
              }
            }}
          >
            <Ionicons name="create-outline" size={20} color={iconColor} />
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          <Text style={[styles.noteText, { color: textColor }]}>
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
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    borderBottomWidth: 1,
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
    marginLeft: 4,
  },
  scanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scanText: {
    fontSize: 11,
    fontWeight: '600',
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
  },
}); 