import { ScrollView, type ScrollViewProps } from 'react-native';

export type CmpScrollViewProps = ScrollViewProps & {
  className?: string;
  contentContainerClassName?: string;
};

export function CmpScrollView({
  showsVerticalScrollIndicator = false,
  keyboardShouldPersistTaps = 'handled',
  className = 'flex-1',
  ...props
}: CmpScrollViewProps) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      className={className}
      {...props}
    />
  );
}
