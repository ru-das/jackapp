import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen } from '@testing-library/react-native';

import Home from '@/app/index';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

test('home shows placeholder', async () => {
  await render(<Home />);
  expect(screen.getByText(/JackApp/)).toBeTruthy();
});

test('dev menu lists the three fixtures', async () => {
  await render(<Home />);
  for (const name of ['Fridge Snap', 'Plant Pal', 'Bill Splitter']) {
    expect(screen.getByLabelText(`Open ${name}`)).toBeTruthy();
  }
});

test('empty Home invites a first build and offers templates with Remix', async () => {
  await render(<Home />);
  expect(await screen.findByText('No mini-apps yet')).toBeTruthy();
  for (const name of ['Fridge Snap', 'Plant Pal', 'Bill Splitter']) {
    expect(screen.getByText(`Try ${name}`)).toBeTruthy();
    expect(screen.getByText(`Remix ${name}`)).toBeTruthy();
  }
});

test('storage failure shows a retry card, never the empty state', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(AsyncStorage, 'getAllKeys').mockRejectedValueOnce(new Error('disk'));
  await render(<Home />);
  expect(await screen.findByText('Couldn’t load your mini-apps')).toBeTruthy();
  expect(screen.queryByText('No mini-apps yet')).toBeNull();
  expect(await screen.findByText('Try again')).toBeTruthy();
});
