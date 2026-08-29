// Relative imports so this can run under `node --test`.
import { referenceMapFromTokens, type TReferenceExtended, type TVariableToken } from "./tokens.ts";
import { splitByReferences } from "./variable-reference-parts.ts";
import type {
  TVariableForCreate,
  TVariableReferenceForCreate,
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

export function getVariablesPair({
  variables,
  tokens,
}: {
  variables: TVariableForCreate[];
  tokens: readonly TVariableToken<TReferenceExtended>[];
}) {
  const referencesByValue = referenceMapFromTokens(tokens);
  const variablesWithParts = variables.map((v) => ({
    name: v.name,
    parts: splitByReferences(v.value, referencesByValue),
  }));

  const variablesRegular: TVariableForCreate[] = variablesWithParts
    .filter((v) => v.parts.every((p) => p.reference === null))
    .map((v) => ({ name: v.name, value: v.parts.map((p) => p.value).join("") }));

  const variableReferences: TVariableReferenceForCreate[] = variablesWithParts
    .filter((v) => v.parts.some((p) => p.reference !== null))
    .map((v) => {
      // TODO: Filter to only unique sources
      const sources: TVariableReferenceForCreate["sources"] = v.parts
        .filter((p) => p.reference !== null)
        .map((p) => {
          const object = p.reference!.object;
          return {
            key: object.key,
            type: object.type,
            source_id: object.source_id,
            source_kubernetes_name: object.source_kubernetes_name,
            source_type: object.source_type,
            source_name: object.source_name,
            source_icon: object.source_icon,
          };
        });

      return {
        name: v.name,
        value: v.parts
          .map((p) => (p.reference !== null ? p.reference.object.template : p.value))
          .join(""),
        sources,
      };
    });
  return {
    variables: variablesRegular,
    variableReferences,
  };
}
