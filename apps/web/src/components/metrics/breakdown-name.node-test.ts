import assert from "node:assert/strict";
import { test } from "node:test";

import { deletedBreakdownName } from "./breakdown-name.ts";

test("uuid keys become a short deleted label", () => {
  assert.equal(deletedBreakdownName("499d9748-0d1c-4b80-95d8-865c0ea273b2"), "Deleted: 499d9748");
  assert.equal(deletedBreakdownName("B459B420-BA56-4CBF-921D-EF94A5A66B88"), "Deleted: B459B420");
});

test("non-uuid keys pass through untouched", () => {
  assert.equal(deletedBreakdownName("unknown"), "unknown");
  assert.equal(deletedBreakdownName(""), "");
  assert.equal(deletedBreakdownName("499d9748"), "499d9748");
});
