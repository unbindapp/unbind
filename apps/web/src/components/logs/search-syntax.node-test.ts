import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSearchInput } from "./search-syntax.ts";

test("empty input", () => {
  const result = parseSearchInput("");
  assert.equal(result.serverSearch, "");
  assert.deepEqual(result.levels, []);
  assert.deepEqual(result.serviceNames, []);
  assert.equal(result.error, null);
});

test("plain words pass through", () => {
  const result = parseSearchInput("timeout redis");
  assert.equal(result.serverSearch, "timeout redis");
  assert.equal(result.error, null);
});

test("quoted phrases pass through", () => {
  const result = parseSearchInput('"connection refused" -"GET /healthz"');
  assert.equal(result.serverSearch, '"connection refused" -"GET /healthz"');
  assert.equal(result.error, null);
});

test("level tokens are extracted", () => {
  const result = parseSearchInput("@level:error timeout @level:WARN");
  assert.equal(result.serverSearch, "timeout");
  assert.deepEqual(result.levels, ["error", "warning"]);
});

test("warn is accepted as an alias for warning", () => {
  const result = parseSearchInput("@level:warning @level:warn");
  assert.deepEqual(result.levels, ["warning"]);
  assert.equal(result.error, null);
});

test("duplicate levels are collapsed", () => {
  const result = parseSearchInput("@level:error @level:error");
  assert.deepEqual(result.levels, ["error"]);
});

test("an unrecognised level is forwarded instead of erroring", () => {
  const result = parseSearchInput("@level:verbose");
  assert.equal(result.error, null);
  assert.equal(result.serverSearch, "@level:verbose");
  assert.deepEqual(result.levels, []);
});

test("a known level next to an unrecognised one is still extracted", () => {
  const result = parseSearchInput("@level:error @level:verbose timeout");
  assert.equal(result.error, null);
  assert.deepEqual(result.levels, ["error"]);
  assert.equal(result.serverSearch, "@level:verbose timeout");
});

test("service tokens are extracted", () => {
  const result = parseSearchInput("@service:api timeout");
  assert.equal(result.serverSearch, "timeout");
  assert.deepEqual(result.serviceNames, ["api"]);
});

test("an unknown service is forwarded instead of filtered", () => {
  const known = new Set(["api", "web-app"]);
  const result = parseSearchInput("@service:nope timeout", known);
  assert.equal(result.error, null);
  assert.deepEqual(result.serviceNames, []);
  assert.equal(result.serverSearch, "@service:nope timeout");
});

test("a known service is still extracted", () => {
  const known = new Set(["api", "web-app"]);
  const result = parseSearchInput("@service:api timeout", known);
  assert.deepEqual(result.serviceNames, ["api"]);
  assert.equal(result.serverSearch, "timeout");
});

test("service matching ignores case", () => {
  const known = new Set(["web-app"]);
  assert.deepEqual(parseSearchInput("@service:Web-App", known).serviceNames, ["Web-App"]);
});

test("every service is extracted while the list is still loading", () => {
  const result = parseSearchInput("@service:anything");
  assert.deepEqual(result.serviceNames, ["anything"]);
  assert.equal(result.serverSearch, "");
});

test("a forwarded service keeps an adjacent AND intact", () => {
  const known = new Set(["api"]);
  const result = parseSearchInput("foo AND @service:nope", known);
  assert.equal(result.error, null);
  assert.equal(result.serverSearch, "foo AND @service:nope");
});

test("negated attribute tokens error", () => {
  const result = parseSearchInput("-@level:error");
  assert.match(result.error ?? "", /cannot be negated/);
});

test("other @ tokens pass through to the server", () => {
  const result = parseSearchInput("@status:500");
  assert.equal(result.serverSearch, "@status:500");
  assert.equal(result.error, null);
});

test("unclosed quote errors", () => {
  const result = parseSearchInput('"unterminated');
  assert.match(result.error ?? "", /Unclosed quote/);
});

test("dangling operator errors", () => {
  assert.match(parseSearchInput("timeout OR").error ?? "", /dangling/);
  assert.match(parseSearchInput("timeout AND").error ?? "", /dangling/);
});

test("operators inside expressions pass through", () => {
  const result = parseSearchInput("timeout OR refused AND -debug");
  assert.equal(result.serverSearch, "timeout OR refused AND -debug");
  assert.equal(result.error, null);
});

test("extracting a token swallows an adjacent AND", () => {
  const result = parseSearchInput("foo AND @level:error");
  assert.equal(result.serverSearch, "foo");
  assert.deepEqual(result.levels, ["error"]);
  assert.equal(result.error, null);
});

test("leading extraction keeps the rest valid", () => {
  const result = parseSearchInput("@level:error AND foo");
  assert.equal(result.serverSearch, "foo");
  assert.deepEqual(result.levels, ["error"]);
  assert.equal(result.error, null);
});

test("extracted token next to OR errors instead of leaving a dangling operator", () => {
  assert.match(parseSearchInput("foo OR @level:error").error ?? "", /combined with OR/);
  assert.match(parseSearchInput("@service:api OR foo").error ?? "", /combined with OR/);
});

test("doubled operators error", () => {
  assert.match(parseSearchInput("a AND AND b").error ?? "", /misplaced/);
});
