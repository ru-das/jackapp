import { fireEvent, render, screen } from '@testing-library/react-native';
import { List, type ListRow } from '@/catalog/List/List';
import * as theme from '@/ui/theme';

const rows = (n: number): ListRow[] => Array.from({ length: n }, (_, i) => ({ key: String(i), title: `Item ${i}`, subtitle: 'x', checked: false }));

// Typing in any field rebuilds every row object and handler closure; rows whose text did not change must not render again.
test('an unchanged row is not rendered again, but a changed one is', async () => {
  const useTheme = jest.spyOn(theme, 'useTheme');
  const view = await render(<List rows={rows(20)} emptyText="none" onToggle={() => {}} />);
  const afterMount = useTheme.mock.calls.length;
  expect(afterMount).toBe(1 + 20); // the list, plus one per row

  await view.rerender(<List rows={rows(20)} emptyText="none" onToggle={() => {}} />);
  expect(useTheme.mock.calls.length - afterMount).toBe(1); // only the list itself

  const changed = rows(20);
  changed[3] = { ...changed[3], checked: true };
  await view.rerender(<List rows={changed} emptyText="none" onToggle={() => {}} />);
  expect(useTheme.mock.calls.length - afterMount).toBe(1 + 1 + 1); // list again, plus the one changed row
  useTheme.mockRestore();
});

test('a memoized row still calls the latest handlers with its index', async () => {
  const first = jest.fn();
  const latest = jest.fn();
  const view = await render(<List rows={rows(3)} emptyText="none" onToggle={first} onDelete={first} onPress={first} />);
  await view.rerender(<List rows={rows(3)} emptyText="none" onToggle={latest} onDelete={latest} onPress={latest} />);
  await fireEvent.press(screen.getByLabelText('Item 1'));
  await fireEvent.press(screen.getByLabelText('Delete Item 2'));
  await fireEvent.press(screen.getByText('Item 0'));
  expect(first).not.toHaveBeenCalled();
  expect(latest.mock.calls).toEqual([[1], [2], [0]]);
});

test('adding or removing a handler changes the row it belongs to', async () => {
  const view = await render(<List rows={rows(2)} emptyText="none" />);
  expect(screen.queryByLabelText('Delete Item 0')).toBeNull();
  await view.rerender(<List rows={rows(2)} emptyText="none" onDelete={() => {}} />);
  expect(screen.getByLabelText('Delete Item 0')).toBeTruthy();
});

test('the empty state is read without the decorative sloth', async () => {
  await render(<List rows={[]} emptyText="Nothing yet" />);
  expect(screen.getByLabelText('Nothing yet')).toBeTruthy();
});
