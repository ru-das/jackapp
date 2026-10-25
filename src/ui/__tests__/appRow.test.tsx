import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppRow } from '@/ui/AppRow';

const mount = (damaged = false) => {
  const fns = { onOpen: jest.fn(), onRename: jest.fn(), onDuplicate: jest.fn(), onDelete: jest.fn() };
  const app = { id: 'a1', name: 'Plants', icon: '🪴', damaged } as never;
  return { ...fns, ui: <AppRow app={app} {...fns} /> };
};

test('a saved app is one row; its actions wait behind More', async () => {
  const m = mount();
  await render(m.ui);
  expect(screen.getByLabelText('Open Plants')).toBeTruthy();
  expect(screen.queryByLabelText('Delete Plants')).toBeNull();
  await fireEvent.press(screen.getByLabelText('More actions for Plants'));
  expect(screen.getByLabelText('More actions for Plants').props.accessibilityState.expanded).toBe(true);
  for (const a of ['Rename', 'Duplicate', 'Delete']) expect(screen.getByLabelText(`${a} Plants`)).toBeTruthy();
});

test('choosing an action runs it and tucks the actions away again', async () => {
  const m = mount();
  await render(m.ui);
  await fireEvent.press(screen.getByLabelText('More actions for Plants'));
  await fireEvent.press(screen.getByLabelText('Delete Plants'));
  expect(m.onDelete).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText('Delete Plants')).toBeNull();
});

test('Rename swaps the row for a field and Save sends the new name', async () => {
  const m = mount();
  await render(m.ui);
  await fireEvent.press(screen.getByLabelText('More actions for Plants'));
  await fireEvent.press(screen.getByLabelText('Rename Plants'));
  await fireEvent.changeText(screen.getByLabelText('New name for Plants'), 'Herbs');
  await fireEvent.press(screen.getByText('Save name'));
  expect(m.onRename).toHaveBeenCalledWith('Herbs');
  expect(screen.getByLabelText('Open Plants')).toBeTruthy();
});

test('a damaged app can only be deleted', async () => {
  const m = mount(true);
  await render(m.ui);
  await fireEvent.press(screen.getByLabelText('More actions for Plants'));
  expect(screen.getByLabelText('Delete Plants')).toBeTruthy();
  expect(screen.queryByLabelText('Rename Plants')).toBeNull();
  expect(screen.queryByLabelText('Duplicate Plants')).toBeNull();
});
