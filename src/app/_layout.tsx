import { Stack } from 'expo-router';
import { Toaster } from '@/ui/Toaster';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const t = useTheme();
  return (
    <>
      <Stack screenOptions={{
        headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text, headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
      }}>
        <Stack.Screen name="index" options={{ title: 'JackApp' }} />
        <Stack.Screen name="create" options={{ title: 'New mini-app' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
      <Toaster />
    </>
  );
}
