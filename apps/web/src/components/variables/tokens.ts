import type { TAvailableVariableReference } from "@/lib/queries/variables";

/**
 * A reference the user can insert. `value` is the readable `${Source.KEY}` form
 * shown and typed; `object.template` holds the `${kubernetes_name.KEY}` form
 * that is actually stored.
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

export function getReferenceVariableReadableNames({
  key,
  object,
}: {
  key: string;
  object: Pick<TAvailableVariableReference, "source_name"> &
    Pick<TAvailableVariableReference, "source_type"> &
    Pick<TAvailableVariableReference, "type"> &
    Pick<TAvailableVariableReference, "source_kubernetes_name">;
}) {
  let readableKey = key;

  if (object.type === "internal_endpoint") {
    readableKey = key.replace(object.source_kubernetes_name, `UNBIND_INTERNAL_URL`);
  } else if (object.type === "external_endpoint") {
    readableKey = `UNBIND_EXTERNAL_URL`;
  }

  let sourceName = object.source_name;

  if (object.source_type === "team") sourceName = "Team";
  else if (object.source_type === "project") sourceName = "Project";
  else if (object.source_type === "environment") sourceName = "Environment";

  return {
    readableKey,
    sourceName,
  };
}

export function referenceMapFromTokens<T>(
  tokens: readonly TVariableToken<T>[],
): Map<string, TVariableToken<T>> {
  return new Map(tokens.map((token) => [token.value, token]));
}

/**
 * Builds the readable `${Source.KEY}` tokens offered in the dropdown, pairing
 * each with the `${kubernetes_name.KEY}` template that actually gets stored.
 */
export function buildReferenceTokens(
  variables: readonly TAvailableVariableReference[],
): TVariableToken<TReferenceExtended>[] {
  const sourceNameMap = new Map<string, string[]>();
  const tokens: TVariableToken<TReferenceExtended>[] = [];

  for (const obj of variables) {
    obj.keys?.forEach((key, index) => {
      const { sourceName, readableKey: baseKey } = getReferenceVariableReadableNames({
        key,
        object: obj,
      });
      let readableKey = baseKey;
      const number = index + 1;

      const existing = sourceNameMap.get(sourceName);
      sourceNameMap.set(
        sourceName,
        existing ? [...existing, obj.source_kubernetes_name] : [obj.source_kubernetes_name],
      );

      const sourceNameIndex = sourceNameMap
        .get(obj.source_name)
        ?.indexOf(obj.source_kubernetes_name);
      const sourceNameSuffix =
        sourceNameIndex !== undefined && sourceNameIndex >= 1 ? `(${sourceNameIndex + 1})` : "";

      if (obj.type === "internal_endpoint" || obj.type === "external_endpoint") {
        if (number > 1) readableKey += `_${number}`;
      }

      tokens.push({
        value: `\${${sourceName}${sourceNameSuffix}.${readableKey}}`,
        brand: obj.source_icon,
        object: { ...obj, template: `\${${obj.source_kubernetes_name}.${key}}`, key },
      });
    });
  }

  return tokens;
}
