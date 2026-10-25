// One import per weight: the package's main entry pulls in every weight, and each would be bundled and precached.
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { onNotificationOpen, registerOffline } from '@/capabilities';
import { Toaster } from '@/ui/Toaster';
import { loadSettings } from '@/storage/settings';
import { font, palettes, setThemePreference, useTheme } from '@/ui/theme';

export default function RootLayout() {
  const t = useTheme();
  const router = useRouter();
  // Bundled with the app (no network). Native text already on screen does not restyle when a family arrives later, so wait; the files are local and this is quick. Web swaps by itself, and the static export must not be blank.
  const [fontsReady] = useFonts({ Fraunces_600SemiBold, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, JetBrainsMono_600SemiBold });
  // Tapping a reminder opens the mini-app it came from.
  useEffect(() => onNotificationOpen((appId) => router.push({ pathname: '/run/[id]', params: { id: appId } })), [router]);
  useEffect(() => registerOffline(), []);
  // The saved choice applies once storage answers; until then the app follows the system, which is also the default.
  useEffect(() => { void loadSettings().then((s) => setThemePreference(s.theme)); }, []);
  if (!fontsReady && Platform.OS !== 'web') return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  // Edge-to-edge Android no longer resizes the window for the keyboard, so every screen's inputs and Save stay reachable through this one wrapper.
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Stack screenOptions={{
        headerStyle: { backgroundColor: t.bg }, headerTintColor: t.text, headerShadowVisible: false, headerTitleStyle: { fontFamily: font.display },
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
