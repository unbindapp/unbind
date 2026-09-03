import {
  autocompletion,
  selectedCompletionIndex,
  setSelectedCompletion,
  type Completion,
} from "@codemirror/autocomplete";
import type { EditorState, Extension } from "@codemirror/state";
import { ViewPlugin, type EditorView } from "@codemirror/view";

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

// CodeMirror only moves the highlighted option with the keyboard. This moves it
// with the pointer too, through the same state effect the arrow keys use, so
// hover, arrows and Enter always agree. The list lives in the body, so the
// listener is on the document and the list is matched back to this editor by
// the aria-controls id CodeMirror sets on the content.
const hoverSelectsOption = ViewPlugin.fromClass(
  class {
    constructor(private readonly view: EditorView) {
      document.addEventListener("mousemove", this.onMove, { passive: true });
    }

    destroy() {
      document.removeEventListener("mousemove", this.onMove);
    }

    private onMove = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const option = event.target.closest<HTMLLIElement>(
        ".cm-tooltip-autocomplete li[role=option]",
      );
      const list = option?.parentElement;
      if (!option || !list || list.id !== this.view.contentDOM.getAttribute("aria-controls"))
        return;

      const index = Number(option.id.slice(list.id.length + 1));
      if (!Number.isInteger(index) || index === selectedCompletionIndex(this.view.state)) return;
      this.view.dispatch({ effects: setSelectedCompletion(index) });
    };
  },
);

export function tokenFieldAutocomplete(
  addToOptions?: TCompletionAddition[],
  anchorToField?: boolean,
): Extension {
  return [
    autocompletion({
      icons: false,
      closeOnBlur: true,
      maxRenderedOptions: 50,
      activateOnCompletion: (completion) => (completion as TChainedCompletion).chain === true,
      tooltipClass: () =>
        anchorToField ? "token-field-tooltip token-field-tooltip-anchored" : "token-field-tooltip",
      optionClass: (completion) => `token-field-option-${completion.type ?? "default"}`,
      ...(addToOptions ? { addToOptions } : {}),
    }),
    hoverSelectsOption,
  ];
}
