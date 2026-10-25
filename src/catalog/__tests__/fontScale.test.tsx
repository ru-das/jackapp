import { render, screen } from '@testing-library/react-native';
import { Stat } from '@/catalog/Stat/Stat';
import { Timer } from '@/catalog/Timer/Timer';

// Large display numbers stop growing at 1.5x so a 2.0 system font size cannot push them out of a phone-width card.
test('Stat value and Timer digits cap their font scale', async () => {
  await render(<><Stat label="Total" value="$1,234.50" /><Timer label="Tea" seconds={90} /></>);
  expect(screen.getByText('$1,234.50').props.maxFontSizeMultiplier).toBe(1.5);
  expect(screen.getByText('01:30').props.maxFontSizeMultiplier).toBe(1.5);
});
