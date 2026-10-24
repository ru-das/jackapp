import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DateInput, validDay } from '../DateInput/DateInput';
import { clock, Timer } from '../Timer/Timer';

test.each([['2026-10-25', true], ['2024-02-29', true], ['2026-02-29', false], ['2026-13-01', false], ['2026-1-5', false], ['soon', false], ['', false]])(
  'validDay(%j) is %s', (text, ok) => expect(validDay(text)).toBe(ok));

describe('DateInput', () => {
  test('a typed valid date is written, an invalid one is flagged and not written, clearing writes null', async () => {
    const onChange = jest.fn();
    await render(<DateInput label="Due" value={null} onChange={onChange} />);
    await fireEvent.changeText(screen.getByLabelText('Due'), '2026-10-25');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-25');
    await fireEvent.changeText(screen.getByLabelText('Due'), '2026-02-30');
    expect(screen.getByText(/Use the form YYYY-MM-DD/)).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(screen.getByLabelText('Due'), '');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
  test('Today sets the injected date; the shown value follows state, including a full ISO timestamp', async () => {
    const onChange = jest.fn();
    await render(<DateInput label="Born" value="2026-10-01T10:00:00.000Z" onChange={onChange} today={() => '2026-10-25'} />);
    expect(screen.getByDisplayValue('2026-10-01')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Today: Born'));
    expect(onChange).toHaveBeenLastCalledWith('2026-10-25');
  });
});

describe('Timer', () => {
  // Modern fake timers also move Date.now, which the countdown reads.
  beforeEach(() => { jest.useFakeTimers({ legacyFakeTimers: false }); });
  afterEach(() => { jest.useRealTimers(); });

  test('clock formats minutes and seconds and never goes negative', () => {
    expect([clock(300), clock(59.2), clock(0), clock(-3), clock(3600)]).toEqual(['05:00', '01:00', '00:00', '00:00', '60:00']);
  });
  test('counts down, pauses, resumes, resets, and calls onDone exactly once at zero', async () => {
    const onDone = jest.fn();
    await render(<Timer label="Tea" seconds={10} onDone={onDone} />);
    expect(screen.getByLabelText('Tea: 00:10 left')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Start Tea'));
    await act(async () => { jest.advanceTimersByTime(4000); });
    expect(screen.getByLabelText('Tea: 00:06 left')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Pause Tea'));
    await act(async () => { jest.advanceTimersByTime(5000); });
    expect(screen.getByLabelText('Tea: 00:06 left')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Resume Tea'));
    await act(async () => { jest.advanceTimersByTime(7000); });
    expect(screen.getByLabelText('Tea: 00:00 left')).toBeTruthy();
    expect(onDone).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Reset Tea'));
    expect(screen.getByLabelText('Tea: 00:10 left')).toBeTruthy();
  });
  test('a bad duration shows 00:00 instead of breaking', async () => {
    await render(<Timer label="Odd" seconds={Number.NaN} />);
    expect(screen.getByLabelText('Odd: 00:00 left')).toBeTruthy();
  });
});
