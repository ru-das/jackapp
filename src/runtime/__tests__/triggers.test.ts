import { h2 } from '@/spec/fixtures';
import { SpecSchema } from '@/spec/schema';
import type { Spec } from '@/spec/types';
import { syncTriggers } from '../triggers';

const mockCaps = { cancelTriggers: jest.fn(async () => {}), ensurePermission: jest.fn(async () => true), scheduleTriggers: jest.fn(async () => {}), isSupported: jest.fn(() => true), scheduleTest: jest.fn() };
jest.mock('@/capabilities', () => ({ cancelTriggers: (...a: unknown[]) => mockCaps.cancelTriggers(...(a as [])), ensurePermission: () => mockCaps.ensurePermission(),
  scheduleTriggers: (...a: unknown[]) => mockCaps.scheduleTriggers(...(a as [])), isSupported: () => mockCaps.isSupported(), scheduleTest: (...a: unknown[]) => mockCaps.scheduleTest(...a) }));

const plantPal: Spec = SpecSchema.parse(h2);
const now = new Date(2026, 9, 25, 10, 0);
beforeEach(() => { jest.clearAllMocks(); mockCaps.ensurePermission.mockResolvedValue(true); mockCaps.isSupported.mockReturnValue(true); });

test('schedules each trigger with its notification text evaluated now', async () => {
  const spec: Spec = SpecSchema.parse({ ...h2, triggers: [{ ...h2.triggers[0], notify: { title: 'Plant Pal 🌱', body: '{{plants|count}} plants to check' } }] });
  expect(await syncTriggers('app-1', spec, { plants: [{ name: 'Fern' }, { name: 'Ivy' }] }, now)).toMatchObject({ scheduled: 1, denied: false, status: 'on', next: new Date(2026, 10, 1, 9, 0) });
  expect(mockCaps.scheduleTriggers).toHaveBeenCalledWith('app-1', [{
    id: 'sunday', plan: { type: 'weekly', weekday: 1, hour: 9, minute: 0 }, title: 'Plant Pal 🌱', body: '2 plants to check' }]);
});

test('an app without triggers only clears old reminders and never asks for permission', async () => {
  const spec: Spec = SpecSchema.parse({ ...h2, triggers: undefined });
  expect(await syncTriggers('app-1', spec, {}, now)).toEqual({ scheduled: 0, denied: false, status: 'none' });
  expect(mockCaps.cancelTriggers).toHaveBeenCalledWith('app-1');
  expect(mockCaps.ensurePermission).not.toHaveBeenCalled();
  expect(mockCaps.scheduleTriggers).not.toHaveBeenCalled();
});

test('refused permission clears reminders and reports `denied` for the status line', async () => {
  mockCaps.ensurePermission.mockResolvedValue(false);
  expect(await syncTriggers('app-1', plantPal, {}, now)).toEqual({ scheduled: 0, denied: true, status: 'denied' });
  expect(mockCaps.scheduleTriggers).not.toHaveBeenCalled();
});

test('a reminder that cannot fire (a one-off in the past) is skipped, the rest still schedule', async () => {
  const spec: Spec = SpecSchema.parse({ ...h2, triggers: [
    { id: 'past', type: 'schedule', schedule: { kind: 'once', at: '2020-01-01T00:00:00Z' }, notify: { title: 'a', body: 'b' } }, h2.triggers[0]] });
  expect(await syncTriggers('app-1', spec, {}, now)).toMatchObject({ scheduled: 1, denied: false, status: 'on' });
  expect((mockCaps.scheduleTriggers.mock.calls[0] as unknown[])[1]).toHaveLength(1);
});

test('a missing native module or unsupported browser reports unavailable instead of throwing', async () => {
  mockCaps.ensurePermission.mockRejectedValue(new Error('no module'));
  expect((await syncTriggers('app-1', plantPal, {}, now)).status).toBe('unavailable');
  mockCaps.isSupported.mockReturnValue(false);
  expect((await syncTriggers('app-1', plantPal, {}, now)).status).toBe('unavailable');
});
