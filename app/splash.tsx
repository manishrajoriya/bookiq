import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { checkOnboardingStatus } from '../utils/onboarding';

const SplashScreen = () => {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const onboardingCompleted = await checkOnboardingStatus();
        
        // Small delay for better UX
        setTimeout(() => {
          if (onboardingCompleted) {
            router.replace('/home');
          } else {
            router.replace('/onboarding');
          }
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        console.error('Error in splash screen:', error);
        // Default to home if there's an error
        router.replace('/home');
        setIsLoading(false);
      }
    };

    checkStatus();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});

export default SplashScreen;
