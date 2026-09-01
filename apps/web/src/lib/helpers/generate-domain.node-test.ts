import assert from "node:assert/strict";
import { test } from "node:test";

import { generateDomain } from "./generate-domain.ts";

test("same seed always produces the same domain", () => {
  const a = generateDomain({ name: "my-app", wildcardDomain: "example.com", seed: "service-id-1" });
  const b = generateDomain({ name: "my-app", wildcardDomain: "example.com", seed: "service-id-1" });
  assert.equal(a, b);
});

test("different seeds produce different domains for the same name", () => {
  const a = generateDomain({ name: "my-app", wildcardDomain: "example.com", seed: "service-id-1" });
  const b = generateDomain({ name: "my-app", wildcardDomain: "example.com", seed: "service-id-2" });
  assert.notEqual(a, b);
});

test("cleans the name and appends a 6-char alphanumeric suffix", () => {
  const domain = generateDomain({
    name: "  My App! ",
    wildcardDomain: "example.com",
    seed: "seed",
  });
  assert.match(domain, /^my-app-[a-z0-9]{6}\.example\.com$/);
});

test("falls back to 'service' for names with no valid characters", () => {
  const domain = generateDomain({ name: "!!!", wildcardDomain: "example.com", seed: "seed" });
  assert.match(domain, /^service-[a-z0-9]{6}\.example\.com$/);
});
