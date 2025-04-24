import { TAvailableVariableReference } from "@/server/trpc/api/variables/types";

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
