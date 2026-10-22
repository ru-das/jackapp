import type { ReactNode } from 'react';
import { View } from 'react-native';
import { space } from '@/ui/theme';
import type { StackProps } from './props';

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' } as const;

export function Stack({ direction, gap, align, wrap, children }: StackProps & { children?: ReactNode }) {
  return (
    <View style={{
      flexDirection: direction === 'horizontal' ? 'row' : 'column', gap: space[gap],
      alignItems: ALIGN[align], flexWrap: wrap ? 'wrap' : 'nowrap',
    }}>
      {children}
    </View>
  );
}
