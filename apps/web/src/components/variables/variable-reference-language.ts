import { resolveReferenceTarget } from "@/components/variables/variable-reference-completion";
import type { TVariableToken } from "@/components/variables/tokens";
import type { TBrandedCompletion } from "@/components/ui/token-field/brand-completion";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { parser } from "./variable-reference.gen";

export type TVariableReferenceData<T> = {
  /** undefined while references are still loading */
  tokens: readonly TVariableToken<T>[] | undefined;
};

const parserWithTags = parser.configure({
  props: [
    styleTags({
      Reference: t.propertyName,
      IncompleteReference: t.invalid,
    }),
  ],
});

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

  const options: TBrandedCompletion[] = data.tokens.map((token) => ({
    label: token.value,
    brand: token.brand,
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
      parser: parserWithTags,
      languageData: {
        autocomplete: (context: CompletionContext) => completionAt(context, getData()),
      },
    }),
  );
}
