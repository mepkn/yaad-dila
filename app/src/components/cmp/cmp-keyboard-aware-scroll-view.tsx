import { cssInterop } from 'nativewind';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';

cssInterop(KeyboardAwareScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

export type CmpKeyboardAwareScrollViewProps = KeyboardAwareScrollViewProps;

export function CmpKeyboardAwareScrollView({
  showsVerticalScrollIndicator = false,
  keyboardShouldPersistTaps = 'never',
  ...props
}: CmpKeyboardAwareScrollViewProps) {
  return (
    <KeyboardAwareScrollView
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    />
  );
}
