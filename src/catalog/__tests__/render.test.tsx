import { render, screen } from '@testing-library/react-native';
import { Button } from '../Button/Button';
import { ImageInput } from '../ImageInput/ImageInput';
import { List } from '../List/List';
import { NumberInput } from '../NumberInput/NumberInput';
import { Select } from '../Select/Select';
import { Stat } from '../Stat/Stat';
import { TextInput } from '../TextInput/TextInput';
import { Toggle } from '../Toggle/Toggle';

const noop = () => {};

test('every input exposes its label to assistive tech', async () => {
  await render(<>
    <TextInput label="Note" value="" multiline={false} onChange={noop} />
    <NumberInput label="People" value={2} step={1} mode="stepper" onChange={noop} />
    <Toggle label="Tip" value={false} onChange={noop} />
    <Select label="Size" value="a" options={['a', 'b']} onChange={noop} />
    <ImageInput label="Photo" value={null} source="any" onPick={noop} />
    <Button label="Go" variant="primary" busy={false} onPress={noop} />
  </>);
  for (const name of ['Note', 'Decrease People', 'Tip', 'Size', 'Take photo: Photo', 'Choose photo: Photo', 'Go']) {
    expect(screen.getByLabelText(name)).toBeTruthy();
  }
});

test('busy button is disabled and stat/list render text', async () => {
  await render(<>
    <Button label="Go" variant="secondary" busy onPress={noop} />
    <Stat label="Each" value="$12.00" />
    <List rows={[{ key: '0', title: 'Eggs', checked: true }]} emptyText="none" onToggle={noop} onDelete={noop} />
  </>);
  expect(screen.getByLabelText('Go').props.accessibilityState.disabled).toBe(true);
  expect(screen.getByLabelText('Each: $12.00')).toBeTruthy();
  expect(screen.getByLabelText('Delete Eggs')).toBeTruthy();
});
