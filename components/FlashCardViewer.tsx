import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useThemeColor } from '../hooks/useThemeColor';

const { width, height } = Dimensions.get('window');

interface FlashCard {
  front: string;
  back: string;
}

interface FlashCardViewerProps {
  visible: boolean;
  onClose: () => void;
  cards: FlashCard[];
  title: string;
}

export default function FlashCardViewer({
  visible,
  onClose,
  cards,
  title
}: FlashCardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showNoteView, setShowNoteView] = useState(false);
  
  // Animation values
  const flipAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Theme colors
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardColor = useThemeColor({}, 'background');
  const borderColor = useThemeColor({}, 'icon');
  const iconColor = useThemeColor({}, 'icon');

  const currentCard = cards[currentIndex];

  const flipCard = () => {
    const toValue = isFlipped ? 0 : 1;
    
    Animated.spring(flipAnim, {
      toValue,
      useNativeDriver: true,
      tension: 10,
      friction: 8,
    }).start();
    
    setIsFlipped(!isFlipped);
  };

  const goToNextCard = () => {
    if (currentIndex < cards.length - 1) {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -width,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
        flipAnim.setValue(0);
      });
    }
  };

  const goToPreviousCard = () => {
    if (currentIndex > 0) {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: width,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentIndex(currentIndex - 1);
        setIsFlipped(false);
        flipAnim.setValue(0);
      });
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      slideAnim.setValue(event.translationX);
      scaleAnim.setValue(1 - Math.abs(event.translationX) / (width * 2));
    })
    .onEnd((event) => {
      if (event.translationX > 100 && currentIndex > 0) {
        goToPreviousCard();
      } else if (event.translationX < -100 && currentIndex < cards.length - 1) {
        goToNextCard();
      } else {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      }
    });

  const tapGesture = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      flipCard();
    });

  const combinedGesture = Gesture.Race(panGesture, tapGesture);

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [
      { rotateY: frontInterpolate },
      { translateX: slideAnim },
      { scale: scaleAnim },
    ],
  };

  const backAnimatedStyle = {
    transform: [
      { rotateY: backInterpolate },
      { translateX: slideAnim },
      { scale: scaleAnim },
    ],
  };

  const resetViewer = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    flipAnim.setValue(0);
    slideAnim.setValue(0);
    scaleAnim.setValue(1);
  };

  const formatCardsAsNote = () => {
    return cards.map((card, index) => 
      `${index + 1}. ${card.front}\n   Answer: ${card.back}`
    ).join('\n\n');
  };

  const toggleNoteView = () => {
    setShowNoteView(!showNoteView);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      onShow={resetViewer}
    >
      <StatusBar barStyle={backgroundColor === '#fff' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={iconColor} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: iconColor }]}>
              {currentIndex + 1} of {cards.length}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={toggleNoteView} style={styles.noteButton}>
              <Ionicons name="document-text-outline" size={24} color={iconColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={flipCard} style={styles.flipButton}>
              <Ionicons name="refresh" size={24} color={iconColor} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Card Container */}
        <View style={styles.cardContainer}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.cardWrapper}>
              <TouchableOpacity 
                activeOpacity={0.9} 
                onPress={flipCard}
                style={styles.cardTouchable}
              >
                {/* Front of Card */}
                <Animated.View
                  style={[
                    styles.card,
                    styles.cardFront,
                    { backgroundColor: cardColor, borderColor },
                    frontAnimatedStyle,
                  ]}
                >
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardText, { color: textColor }]}>
                      {currentCard?.front || 'No content'}
                    </Text>
                    <View style={styles.cardHint}>
                      <Ionicons name="hand-left-outline" size={16} color={iconColor} />
                      <Text style={[styles.hintText, { color: iconColor }]}>
                        Tap to flip
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Back of Card */}
                <Animated.View
                  style={[
                    styles.card,
                    styles.cardBack,
                    { backgroundColor: cardColor, borderColor },
                    backAnimatedStyle,
                  ]}
                >
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardText, { color: textColor }]}>
                      {currentCard?.back || 'No answer'}
                    </Text>
                    <View style={styles.cardHint}>
                      <Ionicons name="hand-left-outline" size={16} color={iconColor} />
                      <Text style={[styles.hintText, { color: iconColor }]}>
                        Tap to flip back
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>
          </GestureDetector>
        </View>

        {/* Navigation Controls */}
        <View style={styles.navigation}>
          <TouchableOpacity
            style={[
              styles.navButton,
              { backgroundColor: cardColor, borderColor },
              currentIndex === 0 && styles.navButtonDisabled
            ]}
            onPress={goToPreviousCard}
            disabled={currentIndex === 0}
          >
            <Ionicons 
              name="chevron-back" 
              size={24} 
              color={currentIndex === 0 ? iconColor : textColor} 
            />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${((currentIndex + 1) / cards.length) * 100}%`,
                    backgroundColor: iconColor 
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressText, { color: iconColor }]}>
              {currentIndex + 1} / {cards.length}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.navButton,
              { backgroundColor: cardColor, borderColor },
              currentIndex === cards.length - 1 && styles.navButtonDisabled
            ]}
            onPress={goToNextCard}
            disabled={currentIndex === cards.length - 1}
          >
            <Ionicons 
              name="chevron-forward" 
              size={24} 
              color={currentIndex === cards.length - 1 ? iconColor : textColor} 
            />
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={[styles.instructionText, { color: iconColor }]}>
            💡 Swipe left/right to navigate • Tap card to flip
          </Text>
        </View>

        {/* Note View Modal */}
        <Modal
          visible={showNoteView}
          animationType="slide"
          transparent={false}
          onRequestClose={toggleNoteView}
        >
          <StatusBar barStyle={backgroundColor === '#fff' ? 'dark-content' : 'light-content'} backgroundColor={backgroundColor} />
          <SafeAreaView style={[styles.container, { backgroundColor }]}>
            {/* Note View Header */}
            <View style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}>
              <TouchableOpacity onPress={toggleNoteView} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={iconColor} />
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
                  {title} - Note View
                </Text>
                <Text style={[styles.subtitle, { color: iconColor }]}>
                  {cards.length} flash cards
                </Text>
              </View>
              <View style={{ width: 40 }} />
            </View>

            {/* Note Content */}
            <ScrollView 
              style={styles.noteContent}
              contentContainerStyle={styles.noteContentContainer}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.noteText, { color: textColor }]}>
                {formatCardsAsNote()}
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteButton: {
    padding: 8,
  },
  flipButton: {
    padding: 8,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardWrapper: {
    width: width - 40,
    height: height * 0.5,
    position: 'relative',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    backgroundColor: '#fff',
  },
  cardBack: {
    backgroundColor: '#f8f9fa',
  },
  cardContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 20,
  },
  cardHint: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 20,
  },
  hintText: {
    fontSize: 12,
    marginLeft: 4,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  instructions: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 40,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  cardTouchable: {
    flex: 1,
  },
  noteContent: {
    flex: 1,
  },
  noteContentContainer: {
    padding: 20,
  },
  noteText: {
    fontSize: 16,
    lineHeight: 24,
  },
}); 