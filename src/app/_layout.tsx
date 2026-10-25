import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { onNotificationOpen, registerOffline } from '@/capabilities';
import { Toaster } from '@/ui/Toaster';
import { useTheme } from '@/ui/theme';

export default function RootLayout() {
  const t = useTheme();
  const router = useRouter();
  // Tapping a reminder opens the mini-app it came from.
  useEffect(() => onNotificationOpen((appId) => router.push({ pathname: '/run/[id]', params: { id: appId } })), [router]);
  useEffect(() => registerOffline(), []);
  return (
    <>
      <Stack screenOptions={{
        headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text, headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: 'New mini-app' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Customize' }} />
      </Stack>
      <Toaster />
    </>
  );
}
