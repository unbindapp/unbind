// Client-side pass over the search input: pulls out @level / @service tokens
// (which map to dedicated API params) and forwards the rest as the server
// search expression. Uses relative imports so it can run under `node --test`.

import { LogLevelSchema, type LogLevel } from "../../lib/server/client.gen.ts";

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

export function parseSearchInput(input: string): TParsedSearchInput {
  const result: TParsedSearchInput = {
    serverSearch: "",
    levels: [],
    serviceNames: [],
    error: null,
  };
  if (!input.trim()) return result;

  const parts: TPart[] = [];
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (char === '"' || (char === "-" && input[i + 1] === '"')) {
      const openQuote = input.indexOf('"', i);
      const closeQuote = input.indexOf('"', openQuote + 1);
      if (closeQuote === -1) {
        result.error = "Unclosed quote";
        return result;
      }
      parts.push({ kind: "term", text: input.slice(i, closeQuote + 1) });
      i = closeQuote + 1;
      continue;
    }

    let end = i;
    while (end < input.length && !/[\s"]/.test(input[end])) end++;
    const word = input.slice(i, end);
    i = end;

    if (word === "AND") {
      parts.push({ kind: "and", text: word });
      continue;
    }
    if (word === "OR") {
      parts.push({ kind: "or", text: word });
      continue;
    }

    const attrMatch = /^(-?)@(level|service):(.+)$/.exec(word);
    if (!attrMatch) {
      parts.push({ kind: "term", text: word });
      continue;
    }
    const [, negation, key, value] = attrMatch;
    if (negation) {
      result.error = `@${key} cannot be negated`;
      return result;
    }
    // extracted tokens are implicitly ANDed with the rest, so swallow an
    // explicit AND next to them; adjacency to OR has no equivalent
    if (parts[parts.length - 1]?.kind === "and") parts.pop();
    if (parts[parts.length - 1]?.kind === "or") {
      result.error = `@${key} cannot be combined with OR`;
      return result;
    }
    if (key === "level") {
      const level = normalizeLevel(value.toLowerCase());
      if (!isLevel(level)) {
        result.error = `Unknown level "${value}" (use debug, info, warning or error)`;
        return result;
      }
      if (!result.levels.includes(level)) result.levels.push(level);
      continue;
    }
    result.serviceNames.push(value);
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
