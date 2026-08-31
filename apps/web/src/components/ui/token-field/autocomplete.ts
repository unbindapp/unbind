import { autocompletion, type Completion } from "@codemirror/autocomplete";
import type { EditorState, Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

/** Completions that open another menu once picked, e.g. a key that expects a value. */
export type TChainedCompletion = Completion & { chain?: boolean };

export type TCompletionAddition = {
  position: number;
  /** match holds flat [from, to, ...] fuzzy-match ranges; CodeMirror passes it untyped. */
  render: (
    completion: Completion,
    state: EditorState,
    view: EditorView,
    match?: readonly number[],
  ) => Node | null;
};

export function tokenFieldAutocomplete(
  addToOptions?: TCompletionAddition[],
  anchorToField?: boolean,
): Extension {
  return autocompletion({
    icons: false,
    closeOnBlur: true,
    maxRenderedOptions: 50,
    activateOnCompletion: (completion) => (completion as TChainedCompletion).chain === true,
    tooltipClass: () =>
      anchorToField ? "token-field-tooltip token-field-tooltip-anchored" : "token-field-tooltip",
    optionClass: (completion) => `token-field-option-${completion.type ?? "default"}`,
    ...(addToOptions ? { addToOptions } : {}),
  });
}
