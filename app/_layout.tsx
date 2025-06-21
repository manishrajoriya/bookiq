import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { initDatabase } from '@/services/historyStorage';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      initDatabase();
    }
  }, [loaded]);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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

      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
