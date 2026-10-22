import { Alert } from 'react-native';

export function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Are you sure?', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
