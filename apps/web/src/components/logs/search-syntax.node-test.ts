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

test("level tokens are extracted, case insensitively", () => {
  const result = parseSearchInput("@level:error timeout @level:WARNING");
  assert.equal(result.serverSearch, "timeout");
  assert.deepEqual(result.levels, ["error", "warning"]);
});

test("warn is no longer an alias, it is forwarded like any other value", () => {
  const result = parseSearchInput("@level:warning @level:warn");
  assert.deepEqual(result.levels, ["warning"]);
  assert.equal(result.serverSearch, "@level:warn");
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
  const result = parseSearchInput("@service:nope timeout", { knownServiceTokens: known });
  assert.equal(result.error, null);
  assert.deepEqual(result.serviceNames, []);
  assert.equal(result.serverSearch, "@service:nope timeout");
});

test("a known service is still extracted", () => {
  const known = new Set(["api", "web-app"]);
  const result = parseSearchInput("@service:api timeout", { knownServiceTokens: known });
  assert.deepEqual(result.serviceNames, ["api"]);
  assert.equal(result.serverSearch, "timeout");
});

test("service matching ignores case", () => {
  const known = new Set(["web-app"]);
  assert.deepEqual(
    parseSearchInput("@service:Web-App", { knownServiceTokens: known }).serviceNames,
    ["Web-App"],
  );
});

test("every service is extracted while the list is still loading", () => {
  const result = parseSearchInput("@service:anything");
  assert.deepEqual(result.serviceNames, ["anything"]);
  assert.equal(result.serverSearch, "");
});

test("a forwarded service keeps an adjacent AND intact", () => {
  const known = new Set(["api"]);
  const result = parseSearchInput("foo AND @service:nope", { knownServiceTokens: known });
  assert.equal(result.error, null);
  assert.equal(result.serverSearch, "foo AND @service:nope");
});

// A viewer already scoped to one service resolves @level only, so @service has
// to read like any other word there.
const levelOnly = { attributeKeys: ["level"] } as const;

test("a key the scope does not resolve is forwarded as an ordinary term", () => {
  const result = parseSearchInput("@service:api timeout", {
    ...levelOnly,
    knownServiceTokens: new Set(["api"]),
  });
  assert.equal(result.error, null);
  assert.deepEqual(result.serviceNames, []);
  assert.equal(result.serverSearch, "@service:api timeout");
});

test("levels are still extracted in a scope that resolves them alone", () => {
  const result = parseSearchInput("@level:error @service:api", {
    ...levelOnly,
    knownServiceTokens: new Set(["api"]),
  });
  assert.deepEqual(result.levels, ["error"]);
  assert.equal(result.serverSearch, "@service:api");
});

test("a key the scope does not resolve can be negated", () => {
  const result = parseSearchInput("-@service:api", levelOnly);
  assert.equal(result.error, null);
  assert.equal(result.serverSearch, "-@service:api");
});

test("a key the scope does not resolve can sit next to OR", () => {
  const result = parseSearchInput("foo OR @service:api", levelOnly);
  assert.equal(result.error, null);
  assert.equal(result.serverSearch, "foo OR @service:api");
});

test("the OR error names only the keys the scope resolves", () => {
  const result = parseSearchInput("@level:error OR foo", levelOnly);
  assert.equal(result.error, "@level cannot be combined with OR");
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

test("range presets are extracted", () => {
  const result = parseSearchInput("@range:1h timeout");
  assert.deepEqual(result.range, { preset: "1h" });
  assert.equal(result.serverSearch, "timeout");
  assert.equal(result.error, null);
});

test("custom ranges are extracted as local time", () => {
  const result = parseSearchInput("@range:2026-01-01_12:00..");
  assert.deepEqual(result.range, {
    from: new Date(2026, 0, 1, 12, 0).getTime(),
    until: undefined,
  });
  const until = parseSearchInput("@range:2026-01-01..2026-01-02");
  assert.deepEqual(until.range, {
    from: new Date(2026, 0, 1).getTime(),
    until: new Date(2026, 0, 2).getTime(),
  });
});

test("an unparseable range is forwarded instead of erroring", () => {
  const result = parseSearchInput("@range:yesterday");
  assert.equal(result.error, null);
  assert.equal(result.range, null);
  assert.equal(result.serverSearch, "@range:yesterday");
});

test("a repeated range errors", () => {
  assert.equal(parseSearchInput("@range:1h @range:5m").error, "@range cannot be repeated");
});

test("a repeated range only counts resolvable values", () => {
  const result = parseSearchInput("@range:1h @range:bogus");
  assert.equal(result.error, null);
  assert.deepEqual(result.range, { preset: "1h" });
  assert.equal(result.serverSearch, "@range:bogus");
});

test("a negated range errors", () => {
  assert.equal(parseSearchInput("-@range:1h").error, "@range cannot be negated");
});

test("a range next to OR errors", () => {
  assert.match(parseSearchInput("foo OR @range:1h").error ?? "", /combined with OR/);
});

test("a scope without a time range forwards @range as a term", () => {
  const result = parseSearchInput("@range:1h timeout", levelOnly);
  assert.equal(result.error, null);
  assert.equal(result.range, null);
  assert.equal(result.serverSearch, "@range:1h timeout");
});

test("an extracted range satisfies a trailing AND", () => {
  const result = parseSearchInput("foo AND @range:1h");
  assert.equal(result.serverSearch, "foo");
  assert.deepEqual(result.range, { preset: "1h" });
  assert.equal(result.error, null);
});

// Picking a value from the dropdown leaves a trailing space behind, so the next
// token can be typed straight away.
test("a trailing space is not a term of its own", () => {
  const result = parseSearchInput("@level:error timeout ");
  assert.equal(result.serverSearch, "timeout");
  assert.deepEqual(result.levels, ["error"]);
  assert.equal(result.error, null);

  const attributesOnly = parseSearchInput("@level:error ");
  assert.equal(attributesOnly.serverSearch, "");
  assert.equal(attributesOnly.error, null);
});
