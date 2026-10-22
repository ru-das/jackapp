import { Stack } from 'expo-router';
import { Toaster } from '@/ui/Toaster';

export default function RootLayout() {
  return (
    <>
      <Stack />
      <Toaster />
    </>
  );
}
