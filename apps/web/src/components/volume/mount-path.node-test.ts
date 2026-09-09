import assert from "node:assert/strict";
import { test } from "node:test";

import { isValidMountPath } from "./mount-path.ts";

test("accepts absolute unix paths", () => {
  for (const path of ["/", "/data", "/var/lib/app", "/a-b_c.d"]) {
    assert.equal(isValidMountPath(path), true, path);
  }
});

test("rejects relative, windows and malformed paths", () => {
  for (const path of [
    "",
    "data",
    "./data",
    "C:\\data",
    "/data//logs",
    "/da:ta",
    "/a?b",
    "/a*",
    "/<a>",
    "/a|b",
    '/a"b',
  ]) {
    assert.equal(isValidMountPath(path), false, path);
  }
});
