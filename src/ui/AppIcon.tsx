import { Image } from 'react-native';

/** The launcher icon, for places that would otherwise show an emoji. Decorative: the text next to it says what it is. */
export function AppIcon({ size = 40 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/icon.png')} accessible={false} accessibilityElementsHidden importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
    />
  );
}
