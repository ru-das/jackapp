import { StackPropsSchema } from './Stack/props';
import { StackMeta } from './Stack/meta';
import { CardPropsSchema } from './Card/props';
import { CardMeta } from './Card/meta';
import { DividerPropsSchema } from './Divider/props';
import { DividerMeta } from './Divider/meta';
import { TextPropsSchema } from './Text/props';
import { TextMeta } from './Text/meta';
import { ImagePropsSchema } from './Image/props';
import { ImageMeta } from './Image/meta';
import { StatPropsSchema } from './Stat/props';
import { StatMeta } from './Stat/meta';
import { TextInputPropsSchema } from './TextInput/props';
import { TextInputMeta } from './TextInput/meta';
import { NumberInputPropsSchema } from './NumberInput/props';
import { NumberInputMeta } from './NumberInput/meta';
import { TogglePropsSchema } from './Toggle/props';
import { ToggleMeta } from './Toggle/meta';
import { SelectPropsSchema } from './Select/props';
import { SelectMeta } from './Select/meta';
import { ImageInputPropsSchema } from './ImageInput/props';
import { ImageInputMeta } from './ImageInput/meta';
import { ListPropsSchema } from './List/props';
import { ListMeta } from './List/meta';
import { DateInputPropsSchema } from './DateInput/props';
import { DateInputMeta } from './DateInput/meta';
import { TimerPropsSchema } from './Timer/props';
import { TimerMeta } from './Timer/meta';
import { ButtonPropsSchema } from './Button/props';
import { ButtonMeta } from './Button/meta';

export const catalog = {
  Stack: { props: StackPropsSchema, meta: StackMeta },
  Card: { props: CardPropsSchema, meta: CardMeta },
  Divider: { props: DividerPropsSchema, meta: DividerMeta },
  Text: { props: TextPropsSchema, meta: TextMeta },
  Image: { props: ImagePropsSchema, meta: ImageMeta },
  Stat: { props: StatPropsSchema, meta: StatMeta },
  TextInput: { props: TextInputPropsSchema, meta: TextInputMeta },
  NumberInput: { props: NumberInputPropsSchema, meta: NumberInputMeta },
  Toggle: { props: TogglePropsSchema, meta: ToggleMeta },
  Select: { props: SelectPropsSchema, meta: SelectMeta },
  ImageInput: { props: ImageInputPropsSchema, meta: ImageInputMeta },
  DateInput: { props: DateInputPropsSchema, meta: DateInputMeta },
  List: { props: ListPropsSchema, meta: ListMeta },
  Button: { props: ButtonPropsSchema, meta: ButtonMeta },
  Timer: { props: TimerPropsSchema, meta: TimerMeta },
} as const;
