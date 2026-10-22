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
      </Stack>
      <Toaster />
    </>
  );
}
