// Relative imports so this can run under `node --test`.
import {
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

export function toStoredVariables(
  variables: readonly TVariableForCreate[],
  tokens: readonly TVariableToken<TReferenceExtended>[],
): TVariableForCreate[] {
  const referencesByValue = referenceMapFromTokens(tokens);
  return variables.map((v) => ({ name: v.name, value: toStoredValue(v.value, referencesByValue) }));
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

export type TLiteralPart = { value: string; unresolved: boolean };

/** Splits a rendered value around the references that stayed literal, so they can be marked. */
export function splitByUnresolved(
  value: string,
  references: readonly TVariableReferenceInfo[],
): TLiteralPart[] {
  const unresolved = references.filter((r) => !r.resolved).map((r) => r.token);
  if (unresolved.length === 0) return [{ value, unresolved: false }];

  const parts: TLiteralPart[] = [];
  let rest = value;
  while (rest.length > 0) {
    let nextIndex = -1;
    let nextToken = "";
    for (const token of unresolved) {
      const index = rest.indexOf(token);
      if (index === -1 || (nextIndex !== -1 && index >= nextIndex)) continue;
      nextIndex = index;
      nextToken = token;
    }
    if (nextIndex === -1) {
      parts.push({ value: rest, unresolved: false });
      break;
    }
    if (nextIndex > 0) parts.push({ value: rest.slice(0, nextIndex), unresolved: false });
    parts.push({ value: nextToken, unresolved: true });
    rest = rest.slice(nextIndex + nextToken.length);
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
