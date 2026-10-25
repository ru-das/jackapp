import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const NONE = { top: 0, bottom: 0, left: 0, right: 0 };

/** Window insets, zero when no provider is mounted (web, tests); useSafeAreaInsets would throw there. */
export const useInsets = () => useContext(SafeAreaInsetsContext) ?? NONE;
