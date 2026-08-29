import { resolveReferenceTarget } from "@/components/variables/variable-reference-completion";
import type { TVariableToken } from "@/components/variables/tokens";
import type { TIconCompletion } from "@/components/ui/token-field/icon-completion";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { LanguageSupport, LRLanguage, syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";
import { parser } from "./variable-reference.gen";

export type TVariableReferenceData<T> = {
  /** undefined while references are still loading */
  tokens: readonly TVariableToken<T>[] | undefined;
};

// Nothing is styled from the grammar: whether a ${...} is a real reference
// depends on the live reference list, so it's decorated below instead. A
// half-typed one is left plain — the dropdown is already showing the matches.
const resolvedReference = Decoration.mark({ class: "tok-key" });

/**
 * Highlights only the references that actually resolve. An unresolved ${...} is
 * sent to the API as a plain string, so it reads as one too.
 */
function resolvedReferenceHighlighter<T>(getData: () => TVariableReferenceData<T>) {
  const build = (view: EditorView) => {
    const known = new Set((getData().tokens ?? []).map((token) => token.value));
    const builder = new RangeSetBuilder<Decoration>();
    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter: (node) => {
          if (node.name !== "Reference") return;
          if (!known.has(view.state.sliceDoc(node.from, node.to))) return;
          builder.add(node.from, node.to, resolvedReference);
        },
      });
    }
    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function completionAt<T>(
  context: CompletionContext,
  data: TVariableReferenceData<T>,
): CompletionResult | null {
  const target = resolveReferenceTarget(context.state.doc.toString(), context.pos);
  if (!target) return null;

  if (!data.tokens) {
    return {
      from: target.from,
      to: target.to,
      options: [{ label: "Loading references...", apply: () => {}, type: "pending" }],
      filter: false,
    };
  }

  const options: TIconCompletion[] = data.tokens.map((token) => ({
    label: token.value,
    iconKey: token.brand,
    type: "reference",
  }));

  return {
    from: target.from,
    to: target.to,
    options,
    validFor: /^\$\{?[^}\n]*$/,
  };
}

export function createVariableReferenceLanguage<T>(getData: () => TVariableReferenceData<T>) {
  return new LanguageSupport(
    LRLanguage.define({
      name: "variable-reference",
      parser,
      languageData: {
        autocomplete: (context: CompletionContext) => completionAt(context, getData()),
      },
    }),
    resolvedReferenceHighlighter(getData),
  );
}
