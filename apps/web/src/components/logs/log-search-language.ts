import type { TChainedCompletion } from "@/components/ui/token-field/autocomplete";
import type { TIconCompletion } from "@/components/ui/token-field/icon-completion";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
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
import { decodeRangeToken, logRangePresets } from "./log-range";
import { resolveCompletionTarget } from "./log-search-completion";
import type { TClientAttributeKey } from "./log-search-scope";
import { parser } from "./log-search.gen";
import { findServiceByToken } from "./service-tokens";

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
 * A chip is the field's "this resolves" signal, so a value only gets one when it
 * names something real. Mirrors what parseSearchInput decides for the same
 * value, which is what makes the chip mean the filter actually applies.
 */
function resolveValueChip(key: string, value: string, data: TLogSearchData) {
  if (key === "level") {
    const level = value.toLowerCase();
    if (!data.levels.includes(level)) return null;
    return levelValueChip[level] ?? valueChip;
  }
  if (key === "range") {
    return decodeRangeToken(value) ? valueChip : null;
  }
  if (key !== "service") return null;
  // Undefined until the list loads. parseSearchInput still extracts the name
  // then, so the chip agrees rather than blinking off and back on.
  if (!data.services) return valueChip;
  return findServiceByToken(data.services, value) ? valueChip : null;
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
        this.decorations = buildAttributeDecorations(view, getData());
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildAttributeDecorations(update.view, getData());
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function buildAttributeDecorations(view: EditorView, data: TLogSearchData) {
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
        if (!resolvesAttribute(data.attributeKeys, name)) return;

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
        const chip = resolveValueChip(name, view.state.sliceDoc(value.from, value.to), data);
        if (chip) builder.add(value.from, value.to, chip);
      },
    });
  }
  return builder.finish();
}

/**
 * A value closes its attribute off, so whatever is typed next belongs to a new
 * token and needs a space in front of it. Keys don't take one: they chain
 * straight into the value menu.
 */
function applyValue(view: EditorView, completion: Completion, from: number, to: number) {
  const spaced = view.state.sliceDoc(to, to + 1) === " ";
  const insert = spaced ? completion.label : `${completion.label} `;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length + (spaced ? 1 : 0) },
    userEvent: "input.complete",
  });
}

const attributeKeyOptions: Record<TClientAttributeKey, TChainedCompletion> = {
  level: { label: "@level:", type: "key", chain: true },
  service: { label: "@service:", type: "key", chain: true },
  range: { label: "@range:", type: "key", chain: true },
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
        apply: applyValue,
      })),
      validFor: /^[^\s"]*$/,
    };
  }

  if (target.key === "range") {
    return {
      from: target.from,
      to: target.to,
      options: logRangePresets.map((preset) => ({
        label: preset,
        type: "range",
        apply: applyValue,
      })),
      validFor: /^[^\s"]*$/,
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
      apply: applyValue,
    }));
    return { from: target.from, to: target.to, options, validFor: /^[^\s"]*$/ };
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
