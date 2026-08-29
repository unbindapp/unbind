import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCompletionTarget } from "./log-search-completion.ts";

test("a bare trigger offers keys", () => {
  assert.deepEqual(resolveCompletionTarget("@", 1), { kind: "key", from: 0, to: 1 });
});

test("a partial key offers keys and replaces the whole key", () => {
  assert.deepEqual(resolveCompletionTarget("@lev", 4), { kind: "key", from: 0, to: 4 });
});

test("a trigger mid-expression resolves against that key only", () => {
  assert.deepEqual(resolveCompletionTarget("foo @serv", 9), { kind: "key", from: 4, to: 9 });
});

test("the colon switches to the value stage", () => {
  assert.deepEqual(resolveCompletionTarget("@level:", 7), {
    kind: "value",
    key: "level",
    from: 7,
    to: 7,
  });
});

test("a partial value is the replacement range", () => {
  assert.deepEqual(resolveCompletionTarget("@level:err", 10), {
    kind: "value",
    key: "level",
    from: 7,
    to: 10,
  });
});

test("the cursor at the end of a complete value still completes it", () => {
  assert.deepEqual(resolveCompletionTarget("@service:api foo", 12), {
    kind: "value",
    key: "service",
    from: 9,
    to: 12,
  });
});

test("a second attribute resolves independently of the first", () => {
  assert.deepEqual(resolveCompletionTarget("@level:error @service:", 22), {
    kind: "value",
    key: "service",
    from: 22,
    to: 22,
  });
});

test("the key stage is still offered with the cursor inside the key", () => {
  assert.deepEqual(resolveCompletionTarget("@level:error timeout", 1), {
    kind: "key",
    from: 0,
    to: 6,
  });
});

test("plain terms offer nothing", () => {
  assert.equal(resolveCompletionTarget("foo bar", 7), null);
  assert.equal(resolveCompletionTarget("", 0), null);
});

test("a space after a value closes the menu", () => {
  assert.equal(resolveCompletionTarget("@level:error timeout", 20), null);
  assert.equal(resolveCompletionTarget("@level:error ", 13), null);
});

test("unknown keys resolve so the source can decline them", () => {
  assert.deepEqual(resolveCompletionTarget("@status:5", 9), {
    kind: "value",
    key: "status",
    from: 8,
    to: 9,
  });
});

test("quoted phrases are not attributes", () => {
  assert.equal(resolveCompletionTarget('"a b"', 3), null);
});
