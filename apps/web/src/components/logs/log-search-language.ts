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

// The key and its value are chipped separately, each tinted with the color its
// text already has: `@level:` keeps the keyword color while the value carries
// its own. Only the levels that are colored in the dropdown get a tint; debug
// and info read as plain foreground there, so they do here too.
const keyChip = Decoration.mark({ class: "tok-chip tok-chip-process" });
const valueChip = Decoration.mark({ class: "tok-chip" });
const levelValueChip: Record<string, Decoration> = {
  error: Decoration.mark({ class: "tok-chip tok-chip-error tok-level-error" }),
  warning: Decoration.mark({ class: "tok-chip tok-chip-warning tok-level-warning" }),
};

function resolvesAttribute(keys: readonly TClientAttributeKey[], key: string) {
  return (keys as readonly string[]).includes(key);
}

/**
 * Highlights only the attributes this scope resolves. Anything else, whether an
 * unrecognised `@foo` or `@service` in a viewer already pinned to one service,
 * is forwarded as an ordinary search term, so it reads as one. The `@` and `:`
 * are dimmed together, and the key and its value each get their own chip, the
 * value tinted with the color it has in the dropdown.
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

        // A chip covers one run of same-colored text, so the dimmed "@" and ":"
        // ride along with the key. Each wraps the marks inside it, so it opens
        // first.
        const colon = node.node.getChild("Colon");
        builder.add(key.from, colon ? colon.to : key.to, keyChip);
        builder.add(key.from, key.from + 1, punctuation);
        builder.add(key.from + 1, key.to, attributeKey);
        if (colon) builder.add(colon.from, colon.to, punctuation);

        const value = node.node.getChild("AttrValue");
        if (!value) return;
        const level =
          name === "level" ? view.state.sliceDoc(value.from, value.to).toLowerCase() : null;
        builder.add(value.from, value.to, (level && levelValueChip[level]) || valueChip);
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
