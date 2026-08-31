import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSearchText, extractSearchFilters } from "./log-filter-search.ts";
import { clientAttributeKeys } from "./log-search-scope.ts";
import type { TServiceToken } from "./service-tokens.ts";

const serviceTokens: TServiceToken[] = [
  { id: "svc-1", name: "Redis", token: "Redis" },
  { id: "svc-2", name: "Web App", token: "Web-App" },
];

const options = { attributeKeys: clientAttributeKeys, serviceTokens, servicesLoaded: true };

describe("extractSearchFilters", () => {
  it("splits tokens off the free text", () => {
    const result = extractSearchFilters("@level:error @service:redis @range:1h timeout", options);
    assert.deepEqual(result, {
      q: "timeout",
      levels: ["error"],
      serviceIds: ["svc-1"],
      range: { preset: "1h" },
      error: null,
    });
  });

  it("keeps service tokens in the text while the list is loading", () => {
    const result = extractSearchFilters("@level:error @service:redis", {
      ...options,
      servicesLoaded: false,
    });
    assert.deepEqual(result.levels, ["error"]);
    assert.deepEqual(result.serviceIds, []);
    assert.equal(result.q, "@service:redis");
  });

  it("keeps the whole input on a malformed search", () => {
    const result = extractSearchFilters('@level:error "unterminated', options);
    assert.match(result.error ?? "", /Unclosed quote/);
    assert.equal(result.q, '@level:error "unterminated');
    assert.deepEqual(result.levels, []);
  });

  it("collapses duplicate services", () => {
    const result = extractSearchFilters("@service:redis @service:Redis", options);
    assert.deepEqual(result.serviceIds, ["svc-1"]);
  });
});

describe("buildSearchText", () => {
  it("renders tokens ahead of the free text in a stable order", () => {
    const text = buildSearchText(
      { levels: ["error", "debug"], serviceIds: ["svc-2"], range: { preset: "6h" } },
      "timeout",
      serviceTokens,
    );
    assert.equal(text, "@level:debug @level:error @service:Web-App @range:6h timeout");
  });

  it("keeps a space behind a trailing token, like picking a completion does", () => {
    const text = buildSearchText(
      { levels: ["error"], serviceIds: [], range: null },
      "",
      serviceTokens,
    );
    assert.equal(text, "@level:error ");
    const extracted = extractSearchFilters(text, options);
    assert.deepEqual(extracted.levels, ["error"]);
    assert.equal(extracted.q, "");
    // and rebuilding is stable, so the sync never oscillates
    assert.equal(buildSearchText(extracted, extracted.q, serviceTokens), text);
  });

  it("skips services without a known token", () => {
    const text = buildSearchText(
      { levels: [], serviceIds: ["svc-gone"], range: null },
      "",
      serviceTokens,
    );
    assert.equal(text, "");
  });

  it("round trips through extractSearchFilters", () => {
    const filters = {
      levels: ["debug", "warning"] as const,
      serviceIds: ["svc-1", "svc-2"],
      range: { from: new Date(2026, 0, 1, 12, 0).getTime(), until: undefined },
    };
    const text = buildSearchText(filters, "timeout refused", serviceTokens);
    const extracted = extractSearchFilters(text, options);
    assert.deepEqual(extracted, {
      q: "timeout refused",
      levels: ["debug", "warning"],
      serviceIds: ["svc-1", "svc-2"],
      range: filters.range,
      error: null,
    });
    // and the rebuilt text is stable, so the sync never oscillates
    assert.equal(buildSearchText(extracted, extracted.q, serviceTokens), text);
  });
});
