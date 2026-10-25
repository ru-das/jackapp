import { Alert } from 'react-native';
import type { ConfirmOptions } from './confirm.web';

export function confirm(message: string, { title, confirmLabel = 'OK', destructive }: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    // A mini-app's own question has no label to offer, so it becomes the title instead of sitting under a generic "Are you sure?".
    const [head, body] = title ? [title, message] : [message, undefined];
    Alert.alert(head, body, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
