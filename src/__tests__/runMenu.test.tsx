import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import Run from '@/app/run/[id]';
import { specKey, writeJson } from '@/storage';

let mockHeader: { headerRight?: () => { props: { onPress(): void } } } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 'r1' }),
  Stack: { Screen: ({ options }: { options: typeof mockHeader }) => { mockHeader = options; return null; } },
}));
jest.mock('@/capabilities', () => ({ toast: jest.fn(), share: jest.fn(async () => {}), confirm: jest.fn(), cancelTriggers: jest.fn(async () => {}) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(async () => {
  await AsyncStorage.clear();
  await writeJson(specKey('r1'), {
    specVersion: '0.1', meta: { name: 'Hello', description: '', icon: '👋' }, state: {},
    screens: [{ id: 'main', title: 'Hello', root: 'root' }],
    elements: { root: { type: 'Text', props: { value: 'Hello run' } } }, actions: {},
  });
});

const openMenu = () => act(async () => { mockHeader.headerRight!().props.onPress(); });

test('with the menu open the mini-app behind it is hidden from the screen reader, and Close menu brings it back', async () => {
  await render(<Run />);
  expect(await screen.findByText('Hello run')).toBeTruthy();

  await openMenu();
  expect(screen.getByText('Export data')).toBeTruthy(); // the menu itself stays reachable
  expect(screen.queryByText('Hello run')).toBeNull(); // RNTL leaves out nodes hidden from accessibility

  await fireEvent.press(screen.getByLabelText('Close menu'));
  expect(screen.getByText('Hello run')).toBeTruthy();
  expect(screen.queryByText('Export data')).toBeNull();
});
