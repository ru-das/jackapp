import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import type { SyncResult } from '@/runtime/triggers';
import { ReminderStatus } from '@/ui/ReminderStatus';

jest.mock('@/runtime/triggers', () => ({ sendTestReminder: jest.fn(async () => new Date('2026-10-25T12:02:00')) }));

let announce: jest.SpyInstance;
beforeEach(() => { announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {}); });
afterEach(() => announce.mockRestore());

const on: SyncResult = { scheduled: 1, denied: false, status: 'on', next: new Date('2026-10-26T08:00:00'), test: { title: 'Plants', body: 'Water them' } };
const denied: SyncResult = { scheduled: 0, denied: true, status: 'denied' };

test('opening an app whose reminders work is quiet', async () => {
  await render(<ReminderStatus appId="a" result={on} />);
  expect(screen.getByText(/Next reminder/)).toBeTruthy();
  expect(announce).not.toHaveBeenCalled();
});

test('a problem is spoken when the app opens', async () => {
  await render(<ReminderStatus appId="a" result={denied} />);
  expect(announce).toHaveBeenCalledWith('Notifications are off for JackApp, so reminders will not show.');
});

test('a later change is spoken, without the decorative bell', async () => {
  const view = await render(<ReminderStatus appId="a" result={denied} />);
  announce.mockClear();
  await view.rerender(<ReminderStatus appId="a" result={on} />);
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce.mock.calls[0][0]).toMatch(/^Next reminder: /);
  expect(announce.mock.calls[0][0]).not.toContain('🔔');
});

test('sending a test says when it will arrive', async () => {
  await render(<ReminderStatus appId="a" result={on} />);
  await act(async () => { await fireEvent.press(screen.getByText('Send a test in 2 minutes')); });
  expect(announce).toHaveBeenCalledWith(expect.stringMatching(/^Test reminder arrives at /));
});

test('nothing renders or is said for an app without reminders', async () => {
  await render(<ReminderStatus appId="a" result={{ scheduled: 0, denied: false, status: 'none' }} />);
  expect(screen.toJSON()).toBeNull();
  expect(announce).not.toHaveBeenCalled();
});
