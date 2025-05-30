import { splitByTokens, TToken } from "@/components/ui/textarea-with-tokens";
import { TReferenceExtended } from "@/components/variables/variables-form-field";
import {
  TAvailableVariableReference,
  TVariableForCreate,
  TVariableReferenceForCreate,
} from "@/server/trpc/api/variables/types";

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

export function getVariablesPair({
  variables,
  tokens,
}: {
  variables: TVariableForCreate[];
  tokens: TToken<TReferenceExtended>[];
}) {
  const variablesWithTokens = variables.map((v) => ({
    name: v.name,
    value: splitByTokens(v.value, tokens),
  }));

  const variablesRegular: TVariableForCreate[] = variablesWithTokens
    .filter((v) => v.value.every((v) => v.token === null))
    .map((v) => ({ name: v.name, value: v.value.map((i) => i.value).join("") }));

  const variableReferences: TVariableReferenceForCreate[] = variablesWithTokens
    .filter((v) => v.value.some((v) => v.token !== null))
    .map((v) => {
      // TODO: Filter to only unique sources
      const sources: TVariableReferenceForCreate["sources"] = v.value
        .filter((i) => i.token !== null)
        .map((i) => {
          const t = i.token!;
          return {
            key: t.object.key,
            type: t.object.type,
            source_id: t.object.source_id,
            source_kubernetes_name: t.object.source_kubernetes_name,
            source_type: t.object.source_type,
            source_name: t.object.source_name,
            source_icon: t.object.source_icon,
          };
        });

      return {
        name: v.name,
        value: v.value.map((i) => (i.token !== null ? i.token.object.template : i.value)).join(""),
        sources,
      };
    });
  return {
    variables: variablesRegular,
    variableReferences,
  };
}
