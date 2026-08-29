import { cloneCachedIcon } from "@/components/icons/icon-cache";
import type { TCompletionAddition } from "@/components/ui/token-field/autocomplete";
import type { Completion } from "@codemirror/autocomplete";

export type TIconCompletion = Completion & { iconKey?: string };

/** Renders each option's icon, cloned from the off-screen cache. */
export const iconCompletionAddition: TCompletionAddition = {
  position: 20,
  render: (completion) => cloneCachedIcon((completion as TIconCompletion).iconKey),
};
