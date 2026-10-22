import { render, screen } from '@testing-library/react-native';

import Home from '@/app/index';

test('home shows placeholder', async () => {
  await render(<Home />);
  expect(screen.getByText(/JackApp/)).toBeTruthy();
});
