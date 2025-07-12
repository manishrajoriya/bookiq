import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import "react-native-reanimated";

import { ThemeProvider } from "../providers/ThemeProvider";

import { useColorScheme } from "@/hooks/useColorScheme";
import { initDatabase } from "@/services/historyStorage";
import * as Linking from 'expo-linking';
import PurchasesProvider from "../providers/PurchasesProvider";
import { ThemeProvider as GlobalThemeProvider } from '../providers/ThemeProvider';
import { supabase } from '../utils/supabase';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <GlobalThemeProvider>
          <PurchasesProvider>
            <Stack screenOptions={{ animation: 'none', animationDuration: 500, animationTypeForReplace: 'push' }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
              <Stack.Screen name="+not-found" />
            </Stack>
          </PurchasesProvider>
        </GlobalThemeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
