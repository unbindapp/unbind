import assert from "node:assert/strict";
import { test } from "node:test";
import { isDomain, isWildcardDomain } from "./is-domain.ts";

test("isWildcardDomain accepts one leading wildcard over a full domain", () => {
  for (const value of ["*.example.com", "*.apps.example.com", "*.münchen.de"]) {
    assert.equal(isWildcardDomain(value), true, value);
  }
  for (const value of [
    "example.com",
    "*.com",
    "*",
    "*.",
    "*.*.example.com",
    "app.*.example.com",
    "*app.example.com",
    "* .example.com",
  ]) {
    assert.equal(isWildcardDomain(value), false, value);
  }
});

test("isDomain never accepts a wildcard", () => {
  assert.equal(isDomain("*.example.com"), false);
  assert.equal(isDomain("app.example.com"), true);
});
