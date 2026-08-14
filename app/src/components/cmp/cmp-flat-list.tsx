import { FlatList, type FlatListProps } from 'react-native';

export type CmpFlatListProps<ItemT> = FlatListProps<ItemT> & {
  className?: string;
  contentContainerClassName?: string;
};

export function CmpFlatList<ItemT>({
  showsVerticalScrollIndicator = false,
  ...props
}: CmpFlatListProps<ItemT>) {
  return <FlatList showsVerticalScrollIndicator={showsVerticalScrollIndicator} {...props} />;
}
