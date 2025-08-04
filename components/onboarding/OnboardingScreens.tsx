import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Animated, Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  bgColor: string;
  textColor: string;
  buttonColor: string;
}

interface OnboardingScreensProps {
  onComplete: () => void;
}

const { width, height } = Dimensions.get('window');

const onboardingData: OnboardingItem[] = [
  {
    id: '1',
    title: 'Welcome to BookIQ',
    description: 'Your personal AI-powered reading companion that helps you learn faster and remember more.',
    icon: 'book-outline',
    bgColor: '#F8F9FF',
    textColor: '#1A1A1A',
    buttonColor: '#4A6CF7',
  },
  {
    id: '2',
    title: 'Smart Scanning',
    description: 'Scan any book page and instantly get summaries, key points, and quizzes.',
    icon: 'scan-outline',
    bgColor: '#FFF8F8',
    textColor: '#1A1A1A',
    buttonColor: '#FF6B6B',
  },
  {
    id: '3',
    title: 'Track Progress',
    description: 'Monitor your reading habits and learning progress with detailed analytics.',
    icon: 'stats-chart-outline',
    bgColor: '#F5F9FF',
    textColor: '#1A1A1A',
    buttonColor: '#4A6CF7',
  },
];

const OnboardingScreens: React.FC<OnboardingScreensProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList<OnboardingItem>>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = React.useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollTo = () => {
    if (currentIndex < onboardingData.length - 1 && slidesRef.current) {
      slidesRef.current.scrollToIndex({ index: currentIndex + 1 });
    } else {
      finishOnboarding();
    }
  };

  const skipOnboarding = () => {
    finishOnboarding();
  };

  const finishOnboarding = async () => {
    // Save that onboarding is completed
    try {
      await AsyncStorage.setItem('@onboarding_completed', 'true');
    } catch (e) {
      console.log('Error saving onboarding status', e);
    }
    onComplete();
  };

  const Paginator = () => {
    return (
      <View style={styles.pagination}>
        {onboardingData.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          
          return (
            <Animated.View
              style={[styles.dot, { width: dotWidth, opacity }]}
              key={i}
            />
          );
        })}
      </View>
    );
  };

  const renderItem = ({ item, index }: { item: OnboardingItem; index: number }) => {
    return (
      <View style={[styles.slide, { backgroundColor: item.bgColor }]}>
        <View style={styles.header}>
          <Text style={[styles.skipText, { color: item.textColor, opacity: 0.7 }]}>
            {index === onboardingData.length - 1 ? '' : 'Skip'}
          </Text>
        </View>
        
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: `${item.buttonColor}20` }]}>
              <Ionicons 
                name={item.icon as any} 
                size={80} 
                color={item.buttonColor}
                style={styles.icon}
              />
            </View>
          </View>
          
          <View style={styles.textContainer}>
            <Text style={[styles.title, { color: item.textColor }]}>{item.title}</Text>
            <Text style={[styles.description, { color: item.textColor, opacity: 0.7 }]}>{item.description}</Text>
          </View>
          
          <View style={styles.footer}>
            <View style={styles.pagination}>
              {onboardingData.map((_, i) => (
                <View 
                  key={i} 
                  style={[
                    styles.dot, 
                    { 
                      backgroundColor: i === index ? item.buttonColor : '#E0E0E0',
                      opacity: i === index ? 1 : 0.5
                    }
                  ]} 
                />
              ))}
            </View>
            
            <TouchableOpacity 
              style={[styles.nextButton, { backgroundColor: item.buttonColor }]}
              onPress={scrollTo}
            >
              <Ionicons name="arrow-forward" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={onboardingData}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={32}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  slide: {
    width,
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 24,
    alignItems: 'flex-end',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  iconContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    opacity: 0.9,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  nextButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  textContainer: {
    paddingHorizontal: 32,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 40,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 32,
    flexDirection: 'row',
  },
  skipText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingScreens;
