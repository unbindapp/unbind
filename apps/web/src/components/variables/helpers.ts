// Relative imports so this can run under `node --test`.
import {
  isOwnReference,
  readableTokenForReference,
  readableTokenMap,
  referenceMapFromTokens,
  type TReferenceExtended,
  type TVariableToken,
} from "./tokens.ts";
import { splitByReferences } from "./variable-reference-parts.ts";
import type {
  TVariableForCreate,
  TVariableReferenceInfo,
  TVariableShallow,
} from "../../lib/queries/variables.ts";

export function unwrapQuotes(value: string) {
  let newValue = value;
  if (newValue.startsWith('"') && newValue.endsWith('"')) {
    newValue = newValue.slice(1, -1);
  }
  return newValue;
}

export function getVariablesFromRawText(text: string) {
  const cleaned = text.trim();
  const lines = cleaned ? cleaned.split("\n") : [];
  const pairs = lines
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [name, ...rest] = line.split("=");
      const value = unwrapQuotes(rest.join("="));
      return { name, value };
    });
  return pairs;
}

/** Readable `${Source.KEY}` tokens become their stored template; unknown ones stay text. */
export function toStoredValue<T extends { template: string }>(
  value: string,
  referencesByValue: ReadonlyMap<string, TVariableToken<T>>,
) {
  return splitByReferences(value, referencesByValue)
    .map((part) => (part.reference !== null ? part.reference.object.template : part.value))
    .join("");
}

/** Each variable is converted without its own token, so a self reference stays text. */
export function toStoredVariables(
  variables: readonly TVariableForCreate[],
  tokens: readonly TVariableToken<TReferenceExtended>[],
  serviceId?: string,
): TVariableForCreate[] {
  const referencesByValue = referenceMapFromTokens(tokens);
  return variables.map((v) => ({
    name: v.name,
    value: toStoredValue(
      v.value,
      referencesForVariable(referencesByValue, tokens, serviceId, v.name),
    ),
  }));
}

/** The reference map for saving one variable: the shared map minus its own token */
export function referencesForVariable<T extends { template: string }>(
  referencesByValue: ReadonlyMap<string, TVariableToken<T>>,
  tokens: readonly TVariableToken<TReferenceExtended>[],
  serviceId: string | undefined,
  name: string,
): ReadonlyMap<string, TVariableToken<T>> {
  const own = tokens.find((token) => isOwnReference(token, serviceId, name));
  if (!own || !referencesByValue.has(own.value)) return referencesByValue;
  const map = new Map(referencesByValue);
  map.delete(own.value);
  return map;
}

const envNamePattern = /^([-._A-Za-z0-9]+)=/;

/** The NAME of the NAME=value line holding pos in a raw editor document */
export function envVariableNameAt(doc: string, pos: number) {
  const start = doc.lastIndexOf("\n", pos - 1) + 1;
  const end = doc.indexOf("\n", pos);
  const line = doc.slice(start, end < 0 ? doc.length : end);
  return envNamePattern.exec(line)?.[1];
}

/** Stored templates become their readable form, using the API's reference list for the value. */
export function toReadableValue(
  value: string,
  references: readonly TVariableReferenceInfo[],
  storedToReadable: ReadonlyMap<string, string>,
) {
  let readable = value;
  for (const reference of references) {
    readable = readable.replaceAll(
      reference.token,
      readableTokenForReference(reference, storedToReadable),
    );
  }
  return readable;
}

export type TRenderedPart = { value: string; reference: TVariableReferenceInfo | null };

/**
 * Splits a stored value into text and reference parts, with each reference
 * carrying what it rendered to. An unresolved reference keeps its stored token.
 */
export function splitByStoredReferences(
  value: string,
  references: readonly TVariableReferenceInfo[],
): TRenderedPart[] {
  if (references.length === 0) return [{ value, reference: null }];

  const parts: TRenderedPart[] = [];
  let rest = value;
  while (rest.length > 0) {
    let next: { index: number; reference: TVariableReferenceInfo } | null = null;
    for (const reference of references) {
      const index = rest.indexOf(reference.token);
      if (index === -1 || (next && index >= next.index)) continue;
      next = { index, reference };
    }
    if (!next) {
      parts.push({ value: rest, reference: null });
      break;
    }
    if (next.index > 0) parts.push({ value: rest.slice(0, next.index), reference: null });
    parts.push({
      value: next.reference.resolved_value ?? next.reference.token,
      reference: next.reference,
    });
    rest = rest.slice(next.index + next.reference.token.length);
  }
  return parts;
}

/**
 * Readable tokens to stored templates for saving edited values. References that
 * are not in the available list (e.g. a source the user can no longer see) keep
 * their stored form instead of turning into text.
 */
export function referenceMapForVariables(
  tokens: readonly TVariableToken<TReferenceExtended>[],
  variables: readonly Pick<TVariableShallow, "references">[],
): Map<string, TVariableToken<{ template: string }>> {
  const storedToReadable = readableTokenMap(tokens);
  const map = new Map<string, TVariableToken<{ template: string }>>(referenceMapFromTokens(tokens));
  for (const variable of variables) {
    for (const reference of variable.references) {
      const readable = readableTokenForReference(reference, storedToReadable);
      if (readable === reference.token || map.has(readable)) continue;
      map.set(readable, { value: readable, object: { template: reference.token } });
    }
  }
  return map;
}

// The first locked variable whose value would be changed, added or removed
export function findChangedLockedVariable(
  locked: string[],
  current: Map<string, string>,
  next: Map<string, string>,
) {
  return locked.find((name) => current.get(name) !== next.get(name)) ?? null;
}

const PROVIDED_URL_PREFIXES = ["UNBIND_URL_", "UNBIND_DATABASE_URL_"];

// URLs are what people come for, so they are split from the hosts and ports
export function splitProvidedVariables<T extends { name: string }>(provided: readonly T[]) {
  const urls: T[] = [];
  const extras: T[] = [];
  for (const variable of provided) {
    const isUrl = PROVIDED_URL_PREFIXES.some((prefix) => variable.name.startsWith(prefix));
    (isUrl ? urls : extras).push(variable);
  }
  return { urls, extras };
}

const PROVIDED_PORT_PREFIX = "UNBIND_PORT_";
const PROVIDED_DATABASE_URL_PREFIX = "UNBIND_DATABASE_URL_";

// A database URL needs the credentials, a port does not, and every port has a URL.
// So the ports say which URLs are still to come.
export function pendingDatabaseUrlNames(provided: readonly { name: string }[]) {
  const existing = new Set(provided.map((v) => v.name));
  return provided
    .filter((v) => v.name.startsWith(PROVIDED_PORT_PREFIX))
    .map((v) => PROVIDED_DATABASE_URL_PREFIX + v.name.slice(PROVIDED_PORT_PREFIX.length))
    .filter((name) => !existing.has(name));
}
