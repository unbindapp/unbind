import type { TChainedCompletion } from "@/components/ui/token-field/autocomplete";
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
import { styleTags, tags as t } from "@lezer/highlight";
import { resolveCompletionTarget } from "./log-search-completion";
import type { TClientAttributeKey } from "./log-search-scope";
import { parser } from "./log-search.gen";

/** Namespaced so a service brand can never collide with a level. */
export const levelIconKey = (level: string) => `level:${level}`;

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
  /** Keys this scope resolves; see logSearchScopes. */
  attributeKeys: readonly TClientAttributeKey[];
};

// Attributes aren't styled from the grammar: whether @foo is one of our keys,
// and what color its value takes, depends on the key rather than the shape, so
// they're decorated below instead.
const parserWithTags = parser.configure({
  props: [
    styleTags({
      Phrase: t.string,
      "Operator/...": t.logicOperator,
      Minus: t.operator,
    }),
  ],
});

const punctuation = Decoration.mark({ class: "tok-punct" });
const attributeKey = Decoration.mark({ class: "tok-key" });
// Only the levels that carry a color in the dropdown; debug and info read as
// plain foreground there, so they do here too.
const levelValue: Record<string, Decoration> = {
  error: Decoration.mark({ class: "tok-level-error" }),
  warning: Decoration.mark({ class: "tok-level-warning" }),
};

function resolvesAttribute(keys: readonly TClientAttributeKey[], key: string) {
  return (keys as readonly string[]).includes(key);
}

/**
 * Highlights only the attributes this scope resolves. Anything else, whether an
 * unrecognised `@foo` or `@service` in a viewer already pinned to one service,
 * is forwarded as an ordinary search term, so it reads as one. The `@` and `:`
 * are dimmed together, and a level's value takes the same color it has in the
 * dropdown.
 */
function createAttributeHighlighter(getData: () => TLogSearchData) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildAttributeDecorations(view, getData().attributeKeys);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildAttributeDecorations(update.view, getData().attributeKeys);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function buildAttributeDecorations(view: EditorView, keys: readonly TClientAttributeKey[]) {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== "Attribute") return;
        const key = node.node.getChild("AttrKey");
        if (!key) return;
        const name = view.state.sliceDoc(key.from + 1, key.to);
        if (!resolvesAttribute(keys, name)) return;

        builder.add(key.from, key.from + 1, punctuation);
        builder.add(key.from + 1, key.to, attributeKey);

        const colon = node.node.getChild("Colon");
        if (colon) builder.add(colon.from, colon.to, punctuation);

        const value = node.node.getChild("AttrValue");
        if (!value || name !== "level") return;
        const mark = levelValue[view.state.sliceDoc(value.from, value.to).toLowerCase()];
        if (mark) builder.add(value.from, value.to, mark);
      },
    });
  }
  return builder.finish();
}

const attributeKeyOptions: Record<TClientAttributeKey, TChainedCompletion> = {
  level: { label: "@level:", type: "key", chain: true },
  service: { label: "@service:", type: "key", chain: true },
};

function completionAt(context: CompletionContext, data: TLogSearchData): CompletionResult | null {
  const target = resolveCompletionTarget(context.state.doc.toString(), context.pos);
  if (!target) return null;

  if (target.kind === "key") {
    return {
      from: target.from,
      to: target.to,
      options: data.attributeKeys.map((key) => attributeKeyOptions[key]),
      validFor: /^@[a-zA-Z0-9_]*$/,
    };
  }

  if (!resolvesAttribute(data.attributeKeys, target.key)) return null;

  if (target.key === "level") {
    return {
      from: target.from,
      to: target.to,
      options: data.levels.map((level) => ({
        label: level,
        iconKey: levelIconKey(level),
        type: `level-${level}`,
      })),
      validFor: /^[^\s":]*$/,
    };
  }

  if (target.key === "service") {
    // undefined while services are still loading: no menu rather than a wrong one
    if (!data.services) return null;
    const options: TIconCompletion[] = data.services.map((service) => ({
      label: service.token,
      detail: service.detail,
      iconKey: service.brand,
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
    createAttributeHighlighter(getData),
  );
}

export { parserWithTags as logSearchParser };
