import type { TAvailableVariableReference, TVariableReferenceInfo } from "@/lib/queries/variables";

/**
 * A reference the user can insert. `value` is the readable `${Source.KEY}` form
 * shown and typed; `object.template` holds the `${{service.<id>.KEY}}` form that
 * is actually stored.
 */
export type TVariableToken<T> = {
  value: string;
  brand?: string;
  object: T;
};

export type TReferenceExtended = TAvailableVariableReference & {
  template: string;
  key: string;
};

type TReferenceSource = Pick<TAvailableVariableReference, "source_type" | "source_name">;

const scopeSourceNames: Record<string, string> = {
  team: "Team",
  project: "Project",
  environment: "Environment",
};

export function readableSourceName(source: TReferenceSource) {
  return scopeSourceNames[source.source_type] ?? source.source_name;
}

export function readableToken(sourceName: string, key: string) {
  return `\${${sourceName}.${key}}`;
}

export function storedToken({
  source_type,
  source_id,
  key,
}: Pick<TAvailableVariableReference, "source_type" | "source_id"> & { key: string }) {
  if (source_type === "service") return `\${{service.${source_id}.${key}}}`;
  return `\${{${source_type}.${key}}}`;
}

export function referenceMapFromTokens<T>(
  tokens: readonly TVariableToken<T>[],
): Map<string, TVariableToken<T>> {
  return new Map(tokens.map((token) => [token.value, token]));
}

/**
 * Builds the readable `${Source.KEY}` tokens offered in the dropdown, pairing
 * each with the stored template. Sources that share a display name get a
 * numeric suffix so the readable forms stay distinct.
 */
export function buildReferenceTokens(
  variables: readonly TAvailableVariableReference[],
): TVariableToken<TReferenceExtended>[] {
  const sourceIdsByName = new Map<string, string[]>();
  const sourceNameFor = (obj: TAvailableVariableReference) => {
    const name = readableSourceName(obj);
    const ids = sourceIdsByName.get(name) ?? [];
    let index = ids.indexOf(obj.source_id);
    if (index === -1) {
      index = ids.length;
      sourceIdsByName.set(name, [...ids, obj.source_id]);
    }
    return index === 0 ? name : `${name}(${index + 1})`;
  };

  const tokens: TVariableToken<TReferenceExtended>[] = [];
  for (const obj of variables) {
    const sourceName = sourceNameFor(obj);
    for (const key of obj.keys ?? []) {
      tokens.push({
        value: readableToken(sourceName, key),
        brand: obj.source_icon,
        object: { ...obj, template: storedToken({ ...obj, key }), key },
      });
    }
  }
  return tokens;
}

/** Stored template -> readable form, for showing values that came from the API */
export function readableTokenMap(
  tokens: readonly TVariableToken<TReferenceExtended>[],
): Map<string, string> {
  return new Map(tokens.map((token) => [token.object.template, token.value]));
}

/**
 * Readable form of a reference found in a stored value. Falls back to the source
 * name the API reports when the reference is not in the available list, and to
 * the stored form when the source is unknown.
 */
export function readableTokenForReference(
  reference: TVariableReferenceInfo,
  storedToReadable: ReadonlyMap<string, string>,
) {
  const known = storedToReadable.get(reference.token);
  if (known) return known;
  const sourceName = readableSourceName(reference);
  if (!sourceName) return reference.token;
  return readableToken(sourceName, reference.key);
}
