import { Alert, type AlertButton } from 'react-native';
import { confirm } from '../confirm.native';

let alert: jest.SpyInstance;
const lastButtons = () => alert.mock.calls.at(-1)![2] as AlertButton[];
beforeEach(() => { alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
afterEach(() => alert.mockRestore());

test('the action is named on the button and the title asks the question', async () => {
  const answer = confirm('Its data goes too.', { title: 'Delete “Plants”?', confirmLabel: 'Delete', destructive: true });
  expect(alert.mock.calls[0].slice(0, 2)).toEqual(['Delete “Plants”?', 'Its data goes too.']);
  expect(lastButtons().map((b) => [b.text, b.style])).toEqual([['Cancel', 'cancel'], ['Delete', 'destructive']]);
  lastButtons()[1].onPress!();
  await expect(answer).resolves.toBe(true);
});

test('a mini-app question becomes the title, with the plain OK it cannot rename', async () => {
  const answer = confirm('Reset the count to zero?');
  expect(alert.mock.calls[0].slice(0, 2)).toEqual(['Reset the count to zero?', undefined]);
  expect(lastButtons().map((b) => b.text)).toEqual(['Cancel', 'OK']);
  lastButtons()[0].onPress!();
  await expect(answer).resolves.toBe(false);
});

test('dismissing the dialog counts as Cancel', async () => {
  const answer = confirm('Reset?');
  (alert.mock.calls[0][3] as { onDismiss(): void }).onDismiss();
  await expect(answer).resolves.toBe(false);
});
