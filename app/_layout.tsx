import { useColorScheme } from "@/hooks/useColorScheme";
import { initDatabase } from "@/services/historyStorage";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from "expo-font";
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import "react-native-reanimated";
import PurchasesProvider from "../providers/PurchasesProvider";
import { ThemeProvider as GlobalThemeProvider, ThemeProvider } from "../providers/ThemeProvider";
import { supabase } from '../utils/supabase';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const onboardingCompleted = await AsyncStorage.getItem('@onboarding_completed');
        if (onboardingCompleted === 'true') {
          setInitialRoute('/home');
        } else {
          setInitialRoute('/onboarding');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setInitialRoute('/home'); // Default to tabs if there's an error
      } finally {
        setIsReady(true);
      }
    };

    checkOnboarding();
  }, []);

  // Redirect to the appropriate screen once initialRoute is determined
  useEffect(() => {
    if (isReady && initialRoute) {
      // Cast to any to bypass the type checking for dynamic routes
      router.replace(initialRoute as any);
    }
  }, [isReady, initialRoute, router]);

  // Show nothing until we know where to navigate
  if (!isReady) {
    return null;
  }

  return (
    <Stack screenOptions={{ animation: 'fade', animationDuration: 300 }}>
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false, animation: 'slide_from_right' }}  />
      <Stack.Screen name="notes" options={{ headerShown: false }} />
      <Stack.Screen name="note/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="study-notes" options={{ headerShown: false }} />
      <Stack.Screen name="quiz-maker" options={{ headerShown: false }} />
      <Stack.Screen name="flash-cards" options={{ headerShown: false }} />
      <Stack.Screen name="mathematics" options={{ headerShown: false }} />
      <Stack.Screen name="biology" options={{ headerShown: false }} />
      <Stack.Screen name="chemistry" options={{ headerShown: false }} />
      <Stack.Screen name="physics" options={{ headerShown: false }} />
      <Stack.Screen name="mind-maps" options={{ headerShown: false }} />
      <Stack.Screen name="paywall" options={{ headerShown: false }} />
      <Stack.Screen name="HistoryList" options={{ headerShown: false }} />
      <Stack.Screen name="ai-scan" options={{ headerShown: false }} />
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (loaded) {
      initDatabase();
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      const { queryParams } = Linking.parse(url);
      let { access_token, refresh_token } = queryParams || {};
      if (Array.isArray(access_token)) access_token = access_token[0];
      if (Array.isArray(refresh_token)) refresh_token = refresh_token[0];
      if (typeof access_token === 'string' && typeof refresh_token === 'string') {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    };
    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => subscription.remove();
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <GlobalThemeProvider>
          <PurchasesProvider>
            <RootLayoutNav />
          </PurchasesProvider>
        </GlobalThemeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
