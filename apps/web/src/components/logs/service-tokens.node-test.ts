import assert from "node:assert/strict";
import { test } from "node:test";

import { buildServiceTokens, findServiceByToken, toServiceToken } from "./service-tokens.ts";

test("safe names are left alone", () => {
  assert.equal(toServiceToken("api"), "api");
  assert.equal(toServiceToken("web-app"), "web-app");
  assert.equal(toServiceToken("my.service_1"), "my.service_1");
});

test("characters that would end the token are replaced", () => {
  assert.equal(toServiceToken("Web App"), "Web-App");
  assert.equal(toServiceToken("Web:App"), "Web-App");
  assert.equal(toServiceToken('Web"App'), "Web-App");
  assert.equal(toServiceToken("Web \t App"), "Web-App");
});

test("leading and trailing separators are trimmed", () => {
  assert.equal(toServiceToken("  Web App  "), "Web-App");
});

test("casing is preserved for display", () => {
  assert.equal(toServiceToken("My App"), "My-App");
});

test("tokens are unique even when names normalize to the same value", () => {
  const tokens = buildServiceTokens([
    { id: "1", name: "Web App" },
    { id: "2", name: "Web-App" },
    { id: "3", name: "Web:App" },
  ]);
  assert.deepEqual(
    tokens.map((t) => t.token),
    ["Web-App", "Web-App-2", "Web-App-3"],
  );
});

test("a name that already looks like a suffixed token does not collide", () => {
  const tokens = buildServiceTokens([
    { id: "1", name: "Web App" },
    { id: "2", name: "Web-App" },
    { id: "3", name: "Web-App-2" },
  ]);
  const unique = new Set(tokens.map((t) => t.token.toLowerCase()));
  assert.equal(unique.size, 3);
});

test("a name with only unsafe characters still gets a token", () => {
  const tokens = buildServiceTokens([{ id: "1", name: "  " }]);
  assert.equal(tokens[0].token, "service");
});

test("lookup is case insensitive", () => {
  const tokens = buildServiceTokens([{ id: "1", name: "My App" }]);
  assert.equal(findServiceByToken(tokens, "my-app")?.id, "1");
  assert.equal(findServiceByToken(tokens, "My-App")?.id, "1");
});

test("lookup resolves each duplicate to its own service", () => {
  const tokens = buildServiceTokens([
    { id: "1", name: "Web App" },
    { id: "2", name: "Web-App" },
  ]);
  assert.equal(findServiceByToken(tokens, "web-app")?.id, "1");
  assert.equal(findServiceByToken(tokens, "web-app-2")?.id, "2");
});

test("unknown tokens resolve to null", () => {
  const tokens = buildServiceTokens([{ id: "1", name: "api" }]);
  assert.equal(findServiceByToken(tokens, "nope"), null);
});
