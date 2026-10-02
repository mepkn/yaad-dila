import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type CmpSelectOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  options: CmpSelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
};

export function CmpSelect<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  className,
}: Props<T>) {
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.value === value);
  return (
    <Select
      value={selected ? { value: selected.value, label: selected.label } : undefined}
      onValueChange={(option) => option && onChange(option.value as T)}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder ?? ""} />
      </SelectTrigger>
      <SelectContent insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} label={o.label} />
        ))}
      </SelectContent>
    </Select>
  );
}
