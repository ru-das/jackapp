import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

/** The one authored motion: a freshly built mini-app rises into place. Skipped when the system asks for reduced motion. */
export function Reveal({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let on = true;
    const show = () => v.setValue(1);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!on) return;
      if (reduce) show();
      else Animated.timing(v, { toValue: 1, duration: 480, easing: Easing.out(Easing.exp), useNativeDriver: Platform.OS !== 'web' }).start();
    }, show);
    return () => { on = false; v.stopAnimation(); };
  }, [v]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
