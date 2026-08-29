import assert from "node:assert/strict";
import { test } from "node:test";

import { getVariablesPair } from "./helpers.ts";
import type { TReferenceExtended, TVariableToken } from "./tokens.ts";

function token(value: string, template: string, key: string): TVariableToken<TReferenceExtended> {
  return {
    value,
    brand: "postgres",
    object: {
      template,
      key,
      type: "variable",
      source_id: "src-1",
      source_kubernetes_name: "pg-a1",
      source_type: "service",
      source_name: "Postgres",
      source_icon: "postgres",
      keys: [key],
    } as unknown as TReferenceExtended,
  };
}

const tokens = [token("${Postgres.DATABASE_URL}", "${pg-a1.DATABASE_URL}", "DATABASE_URL")];

test("plain values stay regular variables", () => {
  const { variables, variableReferences } = getVariablesPair({
    variables: [{ name: "PORT", value: "8080" }],
    tokens,
  });
  assert.deepEqual(variables, [{ name: "PORT", value: "8080" }]);
  assert.deepEqual(variableReferences, []);
});

test("a referencing value becomes a reference with the stored template", () => {
  const { variables, variableReferences } = getVariablesPair({
    variables: [{ name: "URL", value: "${Postgres.DATABASE_URL}" }],
    tokens,
  });
  assert.deepEqual(variables, []);
  assert.equal(variableReferences.length, 1);
  assert.equal(variableReferences[0].name, "URL");
  assert.equal(variableReferences[0].value, "${pg-a1.DATABASE_URL}");
  assert.equal(variableReferences[0].sources.length, 1);
  assert.equal(variableReferences[0].sources[0].key, "DATABASE_URL");
  assert.equal(variableReferences[0].sources[0].source_kubernetes_name, "pg-a1");
});

test("surrounding text is preserved around the template", () => {
  const { variableReferences } = getVariablesPair({
    variables: [{ name: "URL", value: "prefix ${Postgres.DATABASE_URL}/db" }],
    tokens,
  });
  assert.equal(variableReferences[0].value, "prefix ${pg-a1.DATABASE_URL}/db");
});

test("an unknown reference stays a plain value", () => {
  const { variables, variableReferences } = getVariablesPair({
    variables: [{ name: "URL", value: "${Nope.MISSING}" }],
    tokens,
  });
  assert.deepEqual(variables, [{ name: "URL", value: "${Nope.MISSING}" }]);
  assert.deepEqual(variableReferences, []);
});

test("a bare dollar is not treated as a reference", () => {
  const { variables, variableReferences } = getVariablesPair({
    variables: [{ name: "PRICE", value: "$5 per month" }],
    tokens,
  });
  assert.deepEqual(variables, [{ name: "PRICE", value: "$5 per month" }]);
  assert.deepEqual(variableReferences, []);
});

test("regular and referencing variables are split apart", () => {
  const { variables, variableReferences } = getVariablesPair({
    variables: [
      { name: "PORT", value: "8080" },
      { name: "URL", value: "${Postgres.DATABASE_URL}" },
    ],
    tokens,
  });
  assert.deepEqual(
    variables.map((v) => v.name),
    ["PORT"],
  );
  assert.deepEqual(
    variableReferences.map((v) => v.name),
    ["URL"],
  );
});
