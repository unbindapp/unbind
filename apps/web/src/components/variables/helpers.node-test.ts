import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getVariablesFromRawText,
  splitByStoredReferences,
  toReadableValue,
  toStoredVariables,
} from "./helpers.ts";
import { buildReferenceTokens, readableTokenMap, storedToken } from "./tokens.ts";
import type {
  TAvailableVariableReference,
  TVariableReferenceInfo,
} from "../../lib/queries/variables.ts";

const pgId = "3f2a9c1e-7b4d-4e8a-9f0c-1d2e3f4a5b6c";
const redisId = "0c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f";
const redisTwoId = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

const available: TAvailableVariableReference[] = [
  {
    type: "variable",
    source_type: "service",
    source_id: pgId,
    source_name: "Postgres",
    source_icon: "postgres",
    source_kubernetes_name: "pg-a1",
    keys: ["DATABASE_URL", "DATABASE_HOST"],
  },
  {
    type: "variable",
    source_type: "team",
    source_id: "team-id",
    source_name: "My Team",
    source_icon: "team",
    source_kubernetes_name: "team",
    keys: ["REGION"],
  },
  {
    type: "internal_endpoint",
    source_type: "service",
    source_id: redisId,
    source_name: "Redis",
    source_icon: "redis",
    source_kubernetes_name: "redis-a1",
    keys: ["UNBIND_INTERNAL_HOST"],
  },
  {
    type: "internal_endpoint",
    source_type: "service",
    source_id: redisTwoId,
    source_name: "Redis",
    source_icon: "redis",
    source_kubernetes_name: "redis-b2",
    keys: ["UNBIND_INTERNAL_HOST"],
  },
];

const tokens = buildReferenceTokens(available);

test("tokens pair the readable form with the stored template", () => {
  const values = tokens.map((t) => [t.value, t.object.template]);
  assert.deepEqual(values, [
    ["${Postgres.DATABASE_URL}", `\${{service.${pgId}.DATABASE_URL}}`],
    ["${Postgres.DATABASE_HOST}", `\${{service.${pgId}.DATABASE_HOST}}`],
    ["${Team.REGION}", "${{team.REGION}}"],
    ["${Redis.UNBIND_INTERNAL_HOST}", `\${{service.${redisId}.UNBIND_INTERNAL_HOST}}`],
    ["${Redis(2).UNBIND_INTERNAL_HOST}", `\${{service.${redisTwoId}.UNBIND_INTERNAL_HOST}}`],
  ]);
});

test("plain values are stored as typed", () => {
  const variables = toStoredVariables([{ name: "PORT", value: "8080 ${not.known}" }], tokens);
  assert.deepEqual(variables, [{ name: "PORT", value: "8080 ${not.known}" }]);
});

test("readable references become stored templates with surrounding text kept", () => {
  const variables = toStoredVariables(
    [{ name: "URL", value: "prefix ${Postgres.DATABASE_URL}/db ${Team.REGION}" }],
    tokens,
  );
  assert.equal(
    variables[0].value,
    `prefix \${{service.${pgId}.DATABASE_URL}}/db \${{team.REGION}}`,
  );
});

test("stored templates render back to the readable form", () => {
  const value = `x=\${{service.${pgId}.DATABASE_URL}} y=\${{team.REGION}} z=\${{service.${redisTwoId}.UNBIND_INTERNAL_HOST}}`;
  const references: TVariableReferenceInfo[] = [
    reference(`\${{service.${pgId}.DATABASE_URL}}`, "service", pgId, "Postgres", "DATABASE_URL"),
    reference("${{team.REGION}}", "team", "", "My Team", "REGION"),
    reference(
      `\${{service.${redisTwoId}.UNBIND_INTERNAL_HOST}}`,
      "service",
      redisTwoId,
      "Redis",
      "UNBIND_INTERNAL_HOST",
    ),
  ];
  assert.equal(
    toReadableValue(value, references, readableTokenMap(tokens)),
    "x=${Postgres.DATABASE_URL} y=${Team.REGION} z=${Redis(2).UNBIND_INTERNAL_HOST}",
  );
});

test("a reference outside the available list falls back to the API's source name", () => {
  const token = storedToken({ source_type: "service", source_id: "gone-id", key: "KEY" });
  const readable = toReadableValue(
    token,
    [reference(token, "service", "gone-id", "Old", "KEY")],
    new Map(),
  );
  assert.equal(readable, "${Old.KEY}");

  const unknown = toReadableValue(
    token,
    [reference(token, "service", "gone-id", "", "KEY")],
    new Map(),
  );
  assert.equal(unknown, token);
});

test("a stored value splits into text and rendered reference parts", () => {
  const known = storedToken({ source_type: "service", source_id: pgId, key: "DATABASE_URL" });
  const gone = storedToken({ source_type: "service", source_id: "gone-id", key: "KEY" });
  const resolved = {
    ...reference(known, "service", pgId, "Postgres", "DATABASE_URL"),
    resolved_value: "postgres://db",
  };
  const unresolved = { ...reference(gone, "service", "gone-id", "", "KEY"), resolved: false };

  const parts = splitByStoredReferences(`a ${known} b ${gone}`, [resolved, unresolved]);
  assert.deepEqual(parts, [
    { value: "a ", reference: null },
    { value: "postgres://db", reference: resolved },
    { value: " b ", reference: null },
    { value: gone, reference: unresolved },
  ]);
  assert.deepEqual(splitByStoredReferences("plain", []), [{ value: "plain", reference: null }]);
});

test("raw text parses to name/value pairs", () => {
  assert.deepEqual(getVariablesFromRawText('A=1\n\nB="x=y"\n'), [
    { name: "A", value: "1" },
    { name: "B", value: "x=y" },
  ]);
});

function reference(
  token: string,
  source_type: TVariableReferenceInfo["source_type"],
  source_id: string,
  source_name: string,
  key: string,
): TVariableReferenceInfo {
  return { token, source_type, source_id, source_name, source_icon: "", key, resolved: true };
}
