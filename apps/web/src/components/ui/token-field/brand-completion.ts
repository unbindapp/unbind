import { cloneBrandIcon } from "@/components/icons/brand-icon-cache";
import type { Completion } from "@codemirror/autocomplete";
import type { TCompletionAddition } from "@/components/ui/token-field/autocomplete";

export type TBrandedCompletion = Completion & { brand?: string };

/** Renders each option's brand icon, cloned from the off-screen cache. */
export const brandCompletionIcon: TCompletionAddition = {
  position: 20,
  render: (completion) => cloneBrandIcon((completion as TBrandedCompletion).brand),
};
