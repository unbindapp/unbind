import assert from "node:assert/strict";
import { test } from "node:test";

import { getDefaultVolumeName } from "./default-volume-name.ts";

test("slugifies the service name and appends -volume", () => {
  for (const name of ["Deno Test", "deno-test", "deno_test", "  Deno  Test  ", "DENO__TEST"]) {
    assert.equal(getDefaultVolumeName(name), "deno-test-volume", name);
  }
});

test("collapses symbols into single dashes", () => {
  assert.equal(getDefaultVolumeName("My App (v2)!"), "my-app-v2-volume");
  assert.equal(getDefaultVolumeName("api.internal/worker"), "api-internal-worker-volume");
});

test("falls back when nothing usable is left", () => {
  assert.equal(getDefaultVolumeName(""), "service-volume");
  assert.equal(getDefaultVolumeName("!!! ???"), "service-volume");
});

test("stays within the volume name limit", () => {
  assert.equal(getDefaultVolumeName("a".repeat(32)), `${"a".repeat(25)}-volume`);
  assert.equal(getDefaultVolumeName(`${"a".repeat(24)}-bbbbbbb`), `${"a".repeat(24)}-volume`);
});
