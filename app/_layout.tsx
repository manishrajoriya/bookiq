import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import "react-native-reanimated";

import { ThemeProvider } from "../providers/ThemeProvider";

import { useColorScheme } from "@/hooks/useColorScheme";
import { initDatabase } from "@/services/historyStorage";
import PurchasesProvider from "../providers/PurchasesProvider";
import { ThemeProvider as GlobalThemeProvider } from '../providers/ThemeProvider';

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

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <GlobalThemeProvider>
          <PurchasesProvider>
            <Stack screenOptions={{ animation: 'fade', animationDuration: 300, animationTypeForReplace: 'push' }}>
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
              <Stack.Screen name="+not-found" />
            </Stack>
          </PurchasesProvider>
        </GlobalThemeProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
