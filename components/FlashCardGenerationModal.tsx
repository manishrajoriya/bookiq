import { Ionicons } from '@expo/vector-icons';
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
import { generateFlashCardsFromNotes } from '../services/geminiServices';
import { addFlashCardSet } from '../services/historyStorage';
import subscriptionService from '../services/subscriptionService';

type CardType = 'term-definition' | 'question-answer';

interface FlashCardGenerationModalProps {
  visible: boolean;
  onClose: () => void;
  sourceContent: string;
  sourceTitle: string;
  sourceId?: number;
  sourceType?: 'note' | 'scan-note';
  onFlashCardSaved?: () => void;
}

export default function FlashCardGenerationModal({
  visible,
  onClose,
  sourceContent,
  sourceTitle,
  sourceId,
  sourceType = 'note',
  onFlashCardSaved
}: FlashCardGenerationModalProps) {
  const [selectedCardType, setSelectedCardType] = useState<CardType>('term-definition');
  const [generatedCards, setGeneratedCards] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generateFlashCards = async () => {
    if (!sourceContent.trim()) {
      Alert.alert('Error', 'No content available to generate flash cards from.');
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(10);

      const creditResult = await subscriptionService.spendCredits(2);
      if (!creditResult.success) {
        Alert.alert(
          "Out of Credits",
          creditResult.error || "You need at least 2 credits to generate flash cards.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Get Credits", onPress: () => onClose() }
          ]
        );
        setIsGenerating(false);
        setProgress(0);
        return;
      }

      setProgress(30);
      const cards = await generateFlashCardsFromNotes(sourceContent, selectedCardType);
      setProgress(80);
      setGeneratedCards(cards);
      setProgress(100);

    } catch (error) {
      console.error('Flash card generation error:', error);
      Alert.alert('Error', 'Failed to generate flash cards. Please try again.');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  const saveFlashCards = async () => {
    if (!generatedCards.trim()) {
      Alert.alert('Error', 'No flash cards to save.');
      return;
    }

    try {
      const title = `${sourceTitle} - ${selectedCardType.replace('-', ' ')} Flash Cards`;
      
      await addFlashCardSet(
        title,
        generatedCards,
        selectedCardType,
        sourceId,
        sourceType
      );

      Alert.alert('Success!', 'Flash card set has been saved successfully.', [{ text: 'OK' }]);
      onFlashCardSaved?.();
      onClose();
    } catch (error) {
      console.error('Failed to save flash cards:', error);
      Alert.alert('Error', 'Failed to save flash cards. Please try again.');
    }
  };

  const closeModal = () => {
    if (isGenerating) {
      Alert.alert('Generation in Progress', 'Please wait for the flash card generation to complete.', [{ text: 'OK' }]);
      return;
    }
    onClose();
  };

  const resetState = () => {
    setSelectedCardType('term-definition');
    setGeneratedCards('');
    setIsGenerating(false);
    setProgress(0);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={closeModal}
      onShow={resetState}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Generate Flash Cards</Text>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.sourceTitle}>From: {sourceTitle}</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!generatedCards && (
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>Flash Card Settings</Text>
              
              <View style={styles.settingGroup}>
                <Text style={styles.settingLabel}>Card Type</Text>
                <View style={styles.cardTypeButtons}>
                  {(['term-definition', 'question-answer'] as CardType[]).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.cardTypeButton, selectedCardType === type && styles.cardTypeButtonActive]}
                      onPress={() => setSelectedCardType(type)}
                    >
                      <Text style={[styles.cardTypeButtonText, selectedCardType === type && styles.cardTypeButtonTextActive]}>
                        {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
                onPress={generateFlashCards}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="sparkles-outline" size={20} color="white" />
                    <Text style={styles.generateButtonText}>Generate Flash Cards (2 Credits)</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {isGenerating && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Ionicons name="copy-outline" size={24} color="#43e97b" />
                <Text style={styles.progressTitle}>Generating Flash Cards...</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{progress}% complete</Text>
            </View>
          )}

          {generatedCards && (
            <View style={styles.generatedSection}>
              <Text style={styles.sectionTitle}>Generated Flash Cards</Text>
              <View style={styles.generatedContent}>
                <Text style={styles.generatedText}>{generatedCards}</Text>
              </View>
              <TouchableOpacity style={styles.saveButton} onPress={saveFlashCards}>
                <Ionicons name="save-outline" size={20} color="white" />
                <Text style={styles.saveButtonText}>Save Flash Cards</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: {
    paddingTop: Platform.OS === 'ios' ? 12 : 28,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  closeButton: { padding: 4 },
  sourceTitle: { fontSize: 14, color: '#6b7280', fontStyle: 'italic' },
  content: { flex: 1, paddingHorizontal: 20 },
  settingsSection: { marginVertical: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 },
  settingGroup: { marginBottom: 24 },
  settingLabel: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 12 },
  cardTypeButtons: { flexDirection: 'row', gap: 8 },
  cardTypeButton: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  cardTypeButtonActive: { backgroundColor: '#43e97b', borderColor: '#43e97b' },
  cardTypeButtonText: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  cardTypeButtonTextActive: { color: 'white' },
  generateButton: {
    backgroundColor: '#43e97b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  generateButtonDisabled: { backgroundColor: '#9ca3af' },
  generateButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  progressContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  progressTitle: { fontSize: 14, fontWeight: '600', color: '#111827', marginLeft: 8 },
  progressBarContainer: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, marginBottom: 8 },
  progressBar: { height: '100%', backgroundColor: '#43e97b', borderRadius: 2 },
  progressText: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  generatedSection: { marginBottom: 24 },
  generatedContent: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  generatedText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  saveButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 },
}); 