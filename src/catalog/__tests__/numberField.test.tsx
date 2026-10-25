import { fireEvent, render, screen } from '@testing-library/react-native';
import { checkNumber, NumberInput } from '../NumberInput/NumberInput';

test('checkNumber explains each rejection', () => {
  expect(checkNumber('12.5')).toEqual({ value: 12.5 });
  expect(checkNumber(' -3 ')).toEqual({ value: -3 });
  expect(checkNumber('')).toEqual({ error: 'Enter a number' });
  expect(checkNumber('abc')).toEqual({ error: 'Numbers only, like 12.5' });
  expect(checkNumber('-1', 0)).toEqual({ error: 'At least 0' });
  expect(checkNumber('9', 0, 5)).toEqual({ error: 'At most 5' });
});

test('field keeps partial text and commits only valid numbers', async () => {
  const onChange = jest.fn();
  await render(<NumberInput label="Amount" value={5} step={1} mode="field" onChange={onChange} />);
  const input = screen.getByLabelText('Amount');
  await fireEvent.changeText(input, '');
  expect(screen.getByLabelText('Amount').props.value).toBe('');
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.changeText(input, '1.');
  expect(screen.getByLabelText('Amount').props.value).toBe('1.');
  expect(onChange).toHaveBeenLastCalledWith(1);
  await fireEvent.changeText(input, '-');
  expect(screen.queryByText(/Numbers only/)).toBeNull();
});

test('leaving an invalid entry restores the value and says why', async () => {
  await render(<NumberInput label="Amount" value={5} step={1} min={0} mode="field" onChange={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Amount'), 'abc');
  expect(screen.getByText('Numbers only, like 12.5')).toBeTruthy();
  await fireEvent(screen.getByLabelText('Amount'), 'blur');
  expect(screen.getByLabelText('Amount').props.value).toBe('5');
  expect(screen.getByText('Numbers only, like 12.5. Kept 5.')).toBeTruthy();
});
