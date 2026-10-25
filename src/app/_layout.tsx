import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { onNotificationOpen, registerOffline } from '@/capabilities';
import { Toaster } from '@/ui/Toaster';
import { palettes, useTheme } from '@/ui/theme';

export default function RootLayout() {
  const t = useTheme();
  const router = useRouter();
  // Tapping a reminder opens the mini-app it came from.
  useEffect(() => onNotificationOpen((appId) => router.push({ pathname: '/run/[id]', params: { id: appId } })), [router]);
  useEffect(() => registerOffline(), []);
  // Edge-to-edge Android no longer resizes the window for the keyboard, so every screen's inputs and Save stay reachable through this one wrapper.
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack screenOptions={{
        headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text, headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
        // Android's default is light (white) icons, which vanish on the cream light background; 'auto' is iOS-only there.
        statusBarStyle: t === palettes.dark ? 'light' : 'dark',
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="create" options={{ title: 'New mini-app' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Customize' }} />
      </Stack>
      <Toaster />
    </KeyboardAvoidingView>
  );
}
