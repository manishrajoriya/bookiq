import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      animation: 'fade',
      contentStyle: { backgroundColor: '#ffffff' },
    }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
