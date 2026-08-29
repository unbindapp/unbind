import type { TChainedCompletion } from "@/components/ui/token-field/autocomplete";
import type { TBrandedCompletion } from "@/components/ui/token-field/brand-completion";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { LanguageSupport, LRLanguage } from "@codemirror/language";
import { styleTags, tags as t } from "@lezer/highlight";
import { resolveCompletionTarget } from "./log-search-completion";
import { parser } from "./log-search.gen";

// Keys the client resolves itself; anything else is forwarded to the server.
export const clientAttributeKeys = ["level", "service"] as const;
export type TClientAttributeKey = (typeof clientAttributeKeys)[number];

export type TServiceCompletion = {
  /** Tokenizer-safe form, both inserted and matched against. */
  token: string;
  /** Shown next to the token, e.g. the real name when it differs. */
  detail?: string;
  /** Brand key for the option's icon. */
  brand?: string;
};

export type TLogSearchData = {
  levels: readonly string[];
  services: TServiceCompletion[] | undefined;
  servicesEnabled: boolean;
};

const parserWithTags = parser.configure({
  props: [
    styleTags({
      AttrKey: t.propertyName,
      Colon: t.punctuation,
      AttrValue: t.string,
      Phrase: t.string,
      "Operator/...": t.logicOperator,
      Minus: t.operator,
    }),
  ],
});

const attributeKeyOptions: TChainedCompletion[] = clientAttributeKeys.map((key) => ({
  label: `@${key}:`,
  type: "key",
  chain: true,
}));

function completionAt(context: CompletionContext, data: TLogSearchData): CompletionResult | null {
  const target = resolveCompletionTarget(context.state.doc.toString(), context.pos);
  if (!target) return null;

  if (target.kind === "key") {
    return {
      from: target.from,
      to: target.to,
      options: data.servicesEnabled
        ? attributeKeyOptions
        : attributeKeyOptions.filter((o) => o.label !== "@service:"),
      validFor: /^@[a-zA-Z0-9_]*$/,
    };
  }

  if (target.key === "level") {
    return {
      from: target.from,
      to: target.to,
      options: data.levels.map((level) => ({ label: level, type: "level" })),
      validFor: /^[^\s":]*$/,
    };
  }

  if (target.key === "service") {
    if (!data.servicesEnabled) return null;
    // undefined while services are still loading: no menu rather than a wrong one
    if (!data.services) return null;
    const options: TBrandedCompletion[] = data.services.map((service) => ({
      label: service.token,
      detail: service.detail,
      brand: service.brand,
      type: "service",
    }));
    return { from: target.from, to: target.to, options, validFor: /^[^\s":]*$/ };
  }

  return null;
}

export function createLogSearchLanguage(getData: () => TLogSearchData) {
  return new LanguageSupport(
    LRLanguage.define({
      name: "log-search",
      parser: parserWithTags,
      languageData: {
        autocomplete: (context: CompletionContext) => completionAt(context, getData()),
      },
    }),
  );
}

export { parserWithTags as logSearchParser };
