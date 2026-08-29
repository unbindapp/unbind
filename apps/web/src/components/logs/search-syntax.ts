// Client-side pass over the search input: pulls out @level / @service tokens
// (which map to dedicated API params) and forwards the rest as the server
// search expression. Uses relative imports so it can run under `node --test`.

import { LogLevelSchema, type LogLevel } from "../../lib/server/client.gen.ts";
import { parser } from "./log-search.gen.ts";

export type TSearchLogLevel = LogLevel;

export type TParsedSearchInput = {
  serverSearch: string;
  levels: TSearchLogLevel[];
  serviceNames: string[];
  error: string | null;
};

function isLevel(value: string): value is TSearchLogLevel {
  return (LogLevelSchema.options as readonly string[]).includes(value);
}

function normalizeLevel(value: string): string {
  return value === "warn" ? "warning" : value;
}

type TPart = { kind: "term" | "and" | "or"; text: string };

type TNode = { name: string; from: number; to: number };

function topLevelNodes(input: string): TNode[] {
  const nodes: TNode[] = [];
  const cursor = parser.parse(input).cursor();
  if (!cursor.firstChild()) return nodes;
  do {
    if (cursor.name === "Space") continue;
    nodes.push({ name: cursor.name, from: cursor.from, to: cursor.to });
  } while (cursor.nextSibling());
  return nodes;
}

/** Splits `@key:value` into its parts, or null when it isn't a complete attribute. */
function readAttribute(input: string, node: TNode) {
  const text = input.slice(node.from, node.to);
  const colon = text.indexOf(":");
  if (colon < 0) return null;
  const key = text.slice(1, colon);
  const value = text.slice(colon + 1);
  if (!key || !value) return null;
  return { key, value, text };
}

export function parseSearchInput(input: string): TParsedSearchInput {
  const result: TParsedSearchInput = {
    serverSearch: "",
    levels: [],
    serviceNames: [],
    error: null,
  };
  if (!input.trim()) return result;

  const nodes = topLevelNodes(input);
  const parts: TPart[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const text = input.slice(node.from, node.to);

    if (node.name === "Phrase") {
      if (text.length < 2 || !text.endsWith('"')) {
        result.error = "Unclosed quote";
        return result;
      }
      parts.push({ kind: "term", text });
      continue;
    }

    if (node.name === "Negated") {
      if (text.endsWith('"') === false && text.includes('"')) {
        result.error = "Unclosed quote";
        return result;
      }
      parts.push({ kind: "term", text });
      continue;
    }

    if (node.name === "Operator") {
      parts.push({ kind: text === "AND" ? "and" : "or", text });
      continue;
    }

    // A bare Minus directly against an attribute is a negated attribute.
    const next = nodes[i + 1];
    if (node.name === "Minus" && next?.name === "Attribute" && next.from === node.to) {
      const attribute = readAttribute(input, next);
      if (attribute && (attribute.key === "level" || attribute.key === "service")) {
        result.error = `@${attribute.key} cannot be negated`;
        return result;
      }
      parts.push({ kind: "term", text: text + input.slice(next.from, next.to) });
      i++;
      continue;
    }

    if (node.name !== "Attribute") {
      parts.push({ kind: "term", text });
      continue;
    }

    const attribute = readAttribute(input, node);
    if (!attribute || (attribute.key !== "level" && attribute.key !== "service")) {
      parts.push({ kind: "term", text });
      continue;
    }

    // extracted tokens are implicitly ANDed with the rest, so swallow an
    // explicit AND next to them; adjacency to OR has no equivalent
    if (parts[parts.length - 1]?.kind === "and") parts.pop();
    if (parts[parts.length - 1]?.kind === "or") {
      result.error = `@${attribute.key} cannot be combined with OR`;
      return result;
    }

    if (attribute.key === "level") {
      const level = normalizeLevel(attribute.value.toLowerCase());
      if (!isLevel(level)) {
        result.error = `Unknown level "${attribute.value}" (use debug, info, warning or error)`;
        return result;
      }
      if (!result.levels.includes(level)) result.levels.push(level);
      continue;
    }

    result.serviceNames.push(attribute.value);
  }

  // strip operators left dangling by extraction (or typed dangling)
  while (parts.length && parts[0].kind !== "term") {
    if (parts[0].kind === "or") {
      result.error = "@level and @service cannot be combined with OR";
      return result;
    }
    parts.shift();
  }
  while (parts.length && parts[parts.length - 1].kind !== "term") {
    const kind = parts[parts.length - 1].kind;
    const hadExtractions = result.levels.length > 0 || result.serviceNames.length > 0;
    if (kind === "or" || !hadExtractions) {
      result.error = "Search ends with a dangling operator";
      return result;
    }
    parts.pop();
  }
  for (let j = 1; j < parts.length; j++) {
    if (parts[j].kind !== "term" && parts[j - 1].kind !== "term") {
      result.error = "Search has misplaced operators";
      return result;
    }
  }

  result.serverSearch = parts.map((p) => p.text).join(" ");
  return result;
}
