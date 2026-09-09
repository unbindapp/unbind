import assert from "node:assert/strict";
import { test } from "node:test";

import { formatWatchPaths, joinWatchPaths, splitWatchPaths } from "./watch-paths.ts";

test("splits on commas and newlines, trims, drops blanks and duplicates", () => {
  assert.deepEqual(
    splitWatchPaths(" apps/api/**, apps/web/**\n!apps/web/**/*.md ,, apps/api/** "),
    ["apps/api/**", "apps/web/**", "!apps/web/**/*.md"],
  );
  assert.deepEqual(splitWatchPaths(""), []);
  assert.deepEqual(splitWatchPaths(" , \n"), []);
});

test("join and split round-trip", () => {
  const patterns = ["apps/api/**", "!apps/api/**/*.md", "/package.json"];
  assert.deepEqual(splitWatchPaths(joinWatchPaths(patterns)), patterns);
  assert.equal(joinWatchPaths([]), "");
});

test("formats for the staged changes bar", () => {
  assert.equal(formatWatchPaths(""), "Every push");
  assert.equal(
    formatWatchPaths(joinWatchPaths(["apps/**", "!apps/**/*.md"])),
    "apps/**, !apps/**/*.md",
  );
});
