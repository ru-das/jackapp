import { Ionicons } from '@react-native-vector-icons/ionicons';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Decorative: the button or row around an icon carries the label, so screen readers skip it. The colour is explicit so an icon never re-renders its parent's theme reads. */
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  return <Ionicons name={name} size={size} color={color} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
