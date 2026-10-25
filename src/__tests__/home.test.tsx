import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Home from '@/app/index';
import { listApps } from '@/storage/apps';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

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

test('empty Home invites a first build and offers templates with Make similar', async () => {
  await render(<Home />);
  expect(await screen.findByText('No mini-apps yet')).toBeTruthy();
  for (const name of ['Fridge Snap', 'Plant Pal', 'Bill Splitter']) {
    expect(screen.getByText(`Try ${name}`)).toBeTruthy();
    expect(screen.getByText(`Make similar to ${name}`)).toBeTruthy();
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

test('New mini-app comes before the templates, with an AI note on photo templates', async () => {
  await render(<Home />);
  expect(screen.getByText('New mini-app')).toBeTruthy();
  expect(screen.getByText('Try a ready-made mini-app')).toBeTruthy();
  expect(screen.getAllByText(/Reading photos needs AI/)).toHaveLength(2);
  expect(screen.getByText('Works right away.')).toBeTruthy();
});

test.each(['Checklist', 'Tip Calculator'])('ready-made %s saves a valid app and opens it without AI', async (label) => {
  mockPush.mockClear();
  await render(<Home />);
  await fireEvent.press(screen.getByText(label));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/run/[id]', params: { id: expect.any(String) } }));
  expect((await listApps()).some((a) => a.name === label)).toBe(true);
});

test('Settings is an icon button in the header row, found by its label', async () => {
  mockPush.mockClear();
  await render(<Home />);
  await fireEvent.press(screen.getByRole('button', { name: 'Settings' }));
  expect(mockPush).toHaveBeenCalledWith('/settings');
  expect(screen.queryByText('Settings')).toBeNull();
});
