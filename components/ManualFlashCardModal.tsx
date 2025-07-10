import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useThemeColor } from '../hooks/useThemeColor';
import { addFlashCardSet } from '../services/historyStorage';

interface FlashCard {
  id: string;
  front: string;
  back: string;
}

interface ManualFlashCardModalProps {
  visible: boolean;
  onClose: () => void;
  onFlashCardSaved: () => void;
}

export default function ManualFlashCardModal({
  visible,
  onClose,
  onFlashCardSaved
}: ManualFlashCardModalProps) {
  const [setTitle, setSetTitle] = useState('');
  const [cards, setCards] = useState<FlashCard[]>([{
    id: '1',
    front: '',
    back: ''
  }]);
  const [cardType, setCardType] = useState<'term-definition' | 'question-answer'>('term-definition');
  const [isSaving, setIsSaving] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');
  const cardColor = useThemeColor({}, 'background');

  const closeModal = () => {
    if (isSaving) {
      Alert.alert(
        'Saving in Progress',
        'Please wait for the flash card set to be saved.',
        [{ text: 'OK' }]
      );
      return;
    }
    onClose();
    setSetTitle('');
    setCards([{ id: '1', front: '', back: '' }]);
    setCardType('term-definition');
    setCurrentCardIndex(0);
  };

  const addCard = () => {
    const newCard: FlashCard = {
      id: Date.now().toString(),
      front: '',
      back: ''
    };
    setCards([...cards, newCard]);
    setCurrentCardIndex(cards.length);
  };

  const removeCard = (index: number) => {
    if (cards.length <= 1) {
      Alert.alert('Error', 'You must have at least one card.');
      return;
    }
    const updatedCards = cards.filter((_, i) => i !== index);
    setCards(updatedCards);
    if (currentCardIndex >= updatedCards.length) {
      setCurrentCardIndex(updatedCards.length - 1);
    }
  };

  const updateCard = (index: number, field: 'front' | 'back', value: string) => {
    const updatedCards = [...cards];
    updatedCards[index] = { ...updatedCards[index], [field]: value };
    setCards(updatedCards);
  };

  const formatCardsForStorage = () => {
    return cards.map(card => 
      `FRONT: ${card.front}\nBACK: ${card.back}`
    ).join('\n---\n');
  };

  const saveFlashCardSet = async () => {
    if (!setTitle.trim()) {
      Alert.alert('Error', 'Please enter a set title.');
      return;
    }

    // Validate all cards
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card.front.trim()) {
        Alert.alert('Error', `Please enter the front content for card ${i + 1}.`);
        return;
      }
      if (!card.back.trim()) {
        Alert.alert('Error', `Please enter the back content for card ${i + 1}.`);
        return;
      }
    }

    try {
      setIsSaving(true);
      
      const formattedContent = formatCardsForStorage();
      
      await addFlashCardSet(
        setTitle.trim(),
        formattedContent,
        cardType
      );

      Alert.alert(
        'Success!', 
        'Flash card set has been saved successfully.',
        [{ text: 'OK', onPress: () => {
          onFlashCardSaved();
          closeModal();
        }}]
      );
    } catch (error) {
      console.error('Failed to save flash card set:', error);
      Alert.alert('Error', 'Failed to save set. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentCard = cards[currentCardIndex];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={closeModal}
    >
      <StatusBar barStyle={backgroundColor === '#fff' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={iconColor} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
              Create Flash Card Set
            </Text>
            <Text style={[styles.subtitle, { color: iconColor }]}>
              {cards.length} {cards.length === 1 ? 'card' : 'cards'}
            </Text>
          </View>
          <TouchableOpacity onPress={addCard} style={styles.addButton}>
            <Ionicons name="add" size={24} color={iconColor} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Set Title */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Set Title</Text>
            <TextInput
              style={[styles.titleInput, { backgroundColor: cardColor, borderColor, color: textColor }]}
              value={setTitle}
              onChangeText={setSetTitle}
              placeholder="Enter set title..."
              placeholderTextColor={iconColor}
            />
          </View>

          {/* Card Type */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Card Type</Text>
            <View style={styles.cardTypeContainer}>
              {(['term-definition', 'question-answer'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.cardTypeButton,
                    { backgroundColor: cardColor, borderColor },
                    cardType === type && { backgroundColor: iconColor }
                  ]}
                  onPress={() => setCardType(type)}
                >
                  <Text style={[
                    styles.cardTypeText,
                    { color: cardType === type ? backgroundColor : textColor }
                  ]}>
                    {type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Card Navigation */}
          <View style={styles.section}>
            <View style={styles.cardNavigation}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>
                Card {currentCardIndex + 1} of {cards.length}
              </Text>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.cardActionButton, { backgroundColor: cardColor, borderColor }]}
                  onPress={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                  disabled={currentCardIndex === 0}
                >
                  <Ionicons name="chevron-back" size={20} color={currentCardIndex === 0 ? iconColor : textColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cardActionButton, { backgroundColor: cardColor, borderColor }]}
                  onPress={() => setCurrentCardIndex(Math.min(cards.length - 1, currentCardIndex + 1))}
                  disabled={currentCardIndex === cards.length - 1}
                >
                  <Ionicons name="chevron-forward" size={20} color={currentCardIndex === cards.length - 1 ? iconColor : textColor} />
                </TouchableOpacity>
                {cards.length > 1 && (
                  <TouchableOpacity
                    style={[styles.cardActionButton, { backgroundColor: '#ff6b6b', borderColor: '#ff6b6b' }]}
                    onPress={() => removeCard(currentCardIndex)}
                  >
                    <Ionicons name="trash-outline" size={20} color="white" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Current Card */}
          <View style={styles.section}>
            <View style={styles.cardContainer}>
              {/* Front of Card */}
              <View style={styles.cardSide}>
                <Text style={[styles.cardLabel, { color: textColor }]}>
                  {cardType === 'term-definition' ? 'Term' : 'Question'}
                </Text>
                <TextInput
                  style={[styles.cardInput, { backgroundColor: cardColor, borderColor, color: textColor }]}
                  value={currentCard.front}
                  onChangeText={(value) => updateCard(currentCardIndex, 'front', value)}
                  placeholder={cardType === 'term-definition' ? 'Enter term...' : 'Enter question...'}
                  placeholderTextColor={iconColor}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              {/* Back of Card */}
              <View style={styles.cardSide}>
                <Text style={[styles.cardLabel, { color: textColor }]}>
                  {cardType === 'term-definition' ? 'Definition' : 'Answer'}
                </Text>
                <TextInput
                  style={[styles.cardInput, { backgroundColor: cardColor, borderColor, color: textColor }]}
                  value={currentCard.back}
                  onChangeText={(value) => updateCard(currentCardIndex, 'back', value)}
                  placeholder={cardType === 'term-definition' ? 'Enter definition...' : 'Enter answer...'}
                  placeholderTextColor={iconColor}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          {/* Save Button */}
          <View style={styles.section}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: iconColor },
                isSaving && { opacity: 0.7 }
              ]}
              onPress={saveFlashCardSet}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="white" />
                  <Text style={styles.saveButtonText}>Save Flash Card Set</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
  },
  addButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  cardTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cardTypeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  cardTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cardActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    gap: 16,
  },
  cardSide: {
    gap: 8,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 