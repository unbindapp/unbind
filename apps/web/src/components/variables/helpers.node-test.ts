import assert from "node:assert/strict";
import { test } from "node:test";

import {
  envVariableNameAt,
  findChangedLockedVariable,
  getVariablesFromRawText,
  referencesForVariable,
  pendingDatabaseUrlNames,
  splitByStoredReferences,
  splitProvidedVariables,
  toReadableValue,
  toStoredVariables,
} from "./helpers.ts";
import {
  buildReferenceTokens,
  isOwnReference,
  readableTokenMap,
  referenceMapFromTokens,
  storedToken,
} from "./tokens.ts";
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
    type: "private_endpoint",
    source_type: "service",
    source_id: redisId,
    source_name: "Redis",
    source_icon: "redis",
    source_kubernetes_name: "redis-a1",
    keys: ["UNBIND_HOST_PRIVATE"],
  },
  {
    type: "private_endpoint",
    source_type: "service",
    source_id: redisTwoId,
    source_name: "Redis",
    source_icon: "redis",
    source_kubernetes_name: "redis-b2",
    keys: ["UNBIND_HOST_PRIVATE"],
  },
];

const tokens = buildReferenceTokens(available);

test("tokens pair the readable form with the stored template", () => {
  const values = tokens.map((t) => [t.value, t.object.template]);
  assert.deepEqual(values, [
    ["${Postgres.DATABASE_URL}", `\${{service.${pgId}.DATABASE_URL}}`],
    ["${Postgres.DATABASE_HOST}", `\${{service.${pgId}.DATABASE_HOST}}`],
    ["${Team.REGION}", "${{team.REGION}}"],
    ["${Redis.UNBIND_HOST_PRIVATE}", `\${{service.${redisId}.UNBIND_HOST_PRIVATE}}`],
    ["${Redis(2).UNBIND_HOST_PRIVATE}", `\${{service.${redisTwoId}.UNBIND_HOST_PRIVATE}}`],
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
  const value = `x=\${{service.${pgId}.DATABASE_URL}} y=\${{team.REGION}} z=\${{service.${redisTwoId}.UNBIND_HOST_PRIVATE}}`;
  const references: TVariableReferenceInfo[] = [
    reference(`\${{service.${pgId}.DATABASE_URL}}`, "service", pgId, "Postgres", "DATABASE_URL"),
    reference("${{team.REGION}}", "team", "", "My Team", "REGION"),
    reference(
      `\${{service.${redisTwoId}.UNBIND_HOST_PRIVATE}}`,
      "service",
      redisTwoId,
      "Redis",
      "UNBIND_HOST_PRIVATE",
    ),
  ];
  assert.equal(
    toReadableValue(value, references, readableTokenMap(tokens)),
    "x=${Postgres.DATABASE_URL} y=${Team.REGION} z=${Redis(2).UNBIND_HOST_PRIVATE}",
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

test("findChangedLockedVariable flags locked variables that change, appear or disappear", () => {
  const locked = ["DATABASE_USERNAME", "DATABASE_PASSWORD"];
  const current = new Map([
    ["DATABASE_PASSWORD", "real"],
    ["PLAIN", "1"],
  ]);

  assert.equal(
    findChangedLockedVariable(locked, current, new Map([["DATABASE_PASSWORD", "real"]])),
    null,
  );
  assert.equal(
    findChangedLockedVariable(locked, current, new Map([["DATABASE_PASSWORD", "mine"]])),
    "DATABASE_PASSWORD",
  );
  assert.equal(findChangedLockedVariable(locked, current, new Map()), "DATABASE_PASSWORD");
  assert.equal(
    findChangedLockedVariable(
      locked,
      current,
      new Map([
        ["DATABASE_PASSWORD", "real"],
        ["DATABASE_USERNAME", "me"],
      ]),
    ),
    "DATABASE_USERNAME",
  );
});

test("splitProvidedVariables keeps URLs apart from hosts and ports, in order", () => {
  const names = (list: { name: string }[]) => list.map((v) => v.name);
  const toVariables = (list: string[]) => list.map((name) => ({ name }));

  const service = splitProvidedVariables(
    toVariables([
      "UNBIND_HOST_PRIVATE",
      "UNBIND_HOST_PUBLIC",
      "UNBIND_PORT_PRIVATE_8080",
      "UNBIND_URL_PRIVATE",
      "UNBIND_URL_PRIVATE_8080",
      "UNBIND_URL_PUBLIC",
    ]),
  );
  assert.deepEqual(names(service.urls), [
    "UNBIND_URL_PRIVATE",
    "UNBIND_URL_PRIVATE_8080",
    "UNBIND_URL_PUBLIC",
  ]);
  assert.deepEqual(names(service.extras), [
    "UNBIND_HOST_PRIVATE",
    "UNBIND_HOST_PUBLIC",
    "UNBIND_PORT_PRIVATE_8080",
  ]);

  const database = splitProvidedVariables(
    toVariables([
      "UNBIND_DATABASE_URL_PRIVATE",
      "UNBIND_DATABASE_URL_PRIVATE_HTTP",
      "UNBIND_HOST_PRIVATE",
      "UNBIND_PORT_PRIVATE_HTTP",
    ]),
  );
  assert.deepEqual(names(database.urls), [
    "UNBIND_DATABASE_URL_PRIVATE",
    "UNBIND_DATABASE_URL_PRIVATE_HTTP",
  ]);
  assert.deepEqual(names(database.extras), ["UNBIND_HOST_PRIVATE", "UNBIND_PORT_PRIVATE_HTTP"]);

  assert.deepEqual(splitProvidedVariables([]), { urls: [], extras: [] });
});

test("pendingDatabaseUrlNames lists the database URLs that have a port but no value yet", () => {
  const toVariables = (list: string[]) => list.map((name) => ({ name }));

  assert.deepEqual(
    pendingDatabaseUrlNames(
      toVariables([
        "UNBIND_HOST_PRIVATE",
        "UNBIND_HOST_PUBLIC",
        "UNBIND_PORT_PRIVATE",
        "UNBIND_PORT_PRIVATE_HTTP",
        "UNBIND_PORT_PUBLIC",
      ]),
    ),
    [
      "UNBIND_DATABASE_URL_PRIVATE",
      "UNBIND_DATABASE_URL_PRIVATE_HTTP",
      "UNBIND_DATABASE_URL_PUBLIC",
    ],
  );

  assert.deepEqual(
    pendingDatabaseUrlNames(
      toVariables(["UNBIND_DATABASE_URL_PRIVATE", "UNBIND_PORT_PRIVATE", "UNBIND_PORT_PUBLIC"]),
    ),
    ["UNBIND_DATABASE_URL_PUBLIC"],
  );

  assert.deepEqual(pendingDatabaseUrlNames([]), []);
});

test("a variable's own reference is left as text, other own references are stored", () => {
  const own: TAvailableVariableReference = {
    type: "variable",
    source_type: "service",
    source_id: "self-id",
    source_name: "Waft",
    source_icon: "rust",
    source_kubernetes_name: "waft-a1",
    keys: ["PUBLIC_URL", "PORT"],
  };
  const tokens = buildReferenceTokens([...available, own]);
  const [publicUrl, port] = tokens.filter((t) => t.object.source_id === "self-id");
  assert.equal(isOwnReference(publicUrl, "self-id", "PUBLIC_URL"), true);
  assert.equal(isOwnReference(publicUrl, "self-id", "PORT"), false);
  assert.equal(isOwnReference(publicUrl, "other-id", "PUBLIC_URL"), false);
  assert.equal(isOwnReference(publicUrl, undefined, "PUBLIC_URL"), false);

  const stored = toStoredVariables(
    [
      { name: "PUBLIC_URL", value: "${Waft.PUBLIC_URL}/${Waft.PORT}/${Postgres.DATABASE_URL}" },
      { name: "PORT", value: "${Waft.PUBLIC_URL}" },
    ],
    tokens,
    "self-id",
  );
  assert.equal(
    stored[0].value,
    "${Waft.PUBLIC_URL}/" +
      port.object.template +
      "/" +
      storedToken({ source_type: "service", source_id: pgId, key: "DATABASE_URL" }),
  );
  assert.equal(stored[1].value, publicUrl.object.template);

  // Without a service nothing is own
  assert.equal(
    toStoredVariables([{ name: "PUBLIC_URL", value: "${Waft.PUBLIC_URL}" }], tokens)[0].value,
    publicUrl.object.template,
  );

  const map = referenceMapFromTokens(tokens);
  assert.equal(
    referencesForVariable(map, tokens, "self-id", "PUBLIC_URL").has("${Waft.PUBLIC_URL}"),
    false,
  );
  assert.equal(
    referencesForVariable(map, tokens, "self-id", "PUBLIC_URL").has("${Waft.PORT}"),
    true,
  );
  assert.equal(referencesForVariable(map, tokens, "self-id", "OTHER"), map);
});

test("envVariableNameAt reads the name of the line at the cursor", () => {
  const doc = "A=1\nPUBLIC_URL=${\nno equals\nB=";
  assert.equal(envVariableNameAt(doc, 0), "A");
  assert.equal(envVariableNameAt(doc, 3), "A");
  assert.equal(envVariableNameAt(doc, doc.indexOf("${") + 2), "PUBLIC_URL");
  assert.equal(envVariableNameAt(doc, doc.indexOf("equals")), undefined);
  assert.equal(envVariableNameAt(doc, doc.length), "B");
});
