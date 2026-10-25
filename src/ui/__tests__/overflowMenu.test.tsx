import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { OverflowMenu } from '@/ui/OverflowMenu';

test('an item closes the menu and then runs', async () => {
  const calls: string[] = [];
  await render(<OverflowMenu onClose={() => calls.push('close')} items={[{ label: 'Customize', onPress: () => calls.push('customize') }, { label: 'Export data', onPress: () => calls.push('export') }]} />);
  expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  await fireEvent.press(screen.getByText('Export data'));
  expect(calls).toEqual(['close', 'export']);
});

test('tapping outside closes without running anything', async () => {
  const onPress = jest.fn();
  const onClose = jest.fn();
  await render(<OverflowMenu onClose={onClose} items={[{ label: 'Export data', onPress }]} />);
  await fireEvent.press(screen.getByLabelText('Close menu'));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onPress).not.toHaveBeenCalled();
});

test('system Back closes it instead of leaving the screen', async () => {
  type Fn = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers: Fn[] = [];
  const add = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_, h) => { handlers.push(h); return { remove: () => { handlers.splice(handlers.indexOf(h), 1); } }; });
  const onClose = jest.fn();
  const view = await render(<OverflowMenu onClose={onClose} items={[{ label: 'Export data', onPress: () => {} }]} />);
  expect(handlers[0]({} as never)).toBe(true);
  expect(onClose).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(handlers).toHaveLength(0);
  add.mockRestore();
});
