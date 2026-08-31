import assert from "node:assert/strict";
import { test } from "node:test";

import { attributeIconKey, levelIconKey } from "./log-search-icons.ts";

const data = {
  levels: ["debug", "info", "warning", "error"],
  services: [
    { token: "api", brand: "go" },
    { token: "Web-App", brand: "react" },
    { token: "worker" },
  ],
};

test("a known level resolves to its namespaced key", () => {
  assert.equal(attributeIconKey("level", "debug", data), levelIconKey("debug"));
  assert.equal(attributeIconKey("level", "error", data), "level:error");
});

test("levels match regardless of casing", () => {
  assert.equal(attributeIconKey("level", "ERROR", data), "level:error");
});

test("a half-typed or unknown level has no icon", () => {
  assert.equal(attributeIconKey("level", "deb", data), null);
  assert.equal(attributeIconKey("level", "trace", data), null);
  assert.equal(attributeIconKey("level", "", data), null);
});

test("a known service resolves to its brand", () => {
  assert.equal(attributeIconKey("service", "api", data), "go");
  assert.equal(attributeIconKey("service", "web-app", data), "react");
});

test("a service without a brand has no icon", () => {
  assert.equal(attributeIconKey("service", "worker", data), null);
});

test("a service the list doesn't know has no icon", () => {
  assert.equal(attributeIconKey("service", "nope", data), null);
});

test("services still loading resolve to no icon", () => {
  assert.equal(attributeIconKey("service", "api", { ...data, services: undefined }), null);
});

test("a level brand can never be mistaken for a service brand", () => {
  const collides = { ...data, services: [{ token: "svc", brand: "debug" }] };
  assert.notEqual(
    attributeIconKey("service", "svc", collides),
    attributeIconKey("level", "debug", collides),
  );
});

test("keys the field doesn't resolve have no icon", () => {
  assert.equal(attributeIconKey("foo", "debug", data), null);
});
