import { Switch } from "@/components/ui/switch";
import type { ComponentProps } from "react";

export function CmpSwitch(props: ComponentProps<typeof Switch>) {
  return <Switch {...props} />;
}
