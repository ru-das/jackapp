import { render, screen } from '@testing-library/react-native';
import { Stat } from '@/catalog/Stat/Stat';
import { Timer } from '@/catalog/Timer/Timer';

// Large display numbers grow to 2x (the largest system size) and then shrink to fit the card's width, so they never leave a phone-width card.
test('Stat value and Timer digits cap their font scale and fit the card', async () => {
  await render(<><Stat label="Total" value="$1,234.50" /><Timer label="Tea" seconds={90} /></>);
  expect(screen.getByText('$1,234.50').props.maxFontSizeMultiplier).toBe(2);
  expect(screen.getByText('$1,234.50').props.adjustsFontSizeToFit).toBe(true);
  expect(screen.getByText('01:30').props.maxFontSizeMultiplier).toBe(2);
  expect(screen.getByText('01:30').props.adjustsFontSizeToFit).toBe(true);
});
