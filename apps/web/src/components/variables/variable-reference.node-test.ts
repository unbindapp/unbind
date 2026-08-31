import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resolveReferenceInsertion,
  resolveReferenceTarget,
} from "./variable-reference-completion.ts";
import { splitByReferences } from "./variable-reference-parts.ts";

const references = new Map([
  ["${Postgres.DATABASE_URL}", { id: "pg" }],
  ["${Redis(2).URL}", { id: "redis" }],
]);

test("a value with no references is one text part", () => {
  const parts = splitByReferences("plain value", references);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].value, "plain value");
  assert.equal(parts[0].reference, null);
});

test("an empty value stays a single empty part", () => {
  const parts = splitByReferences("", references);
  assert.deepEqual(parts, [{ value: "", from: 0, to: 0, reference: null }]);
});

test("a known reference is split out with its object", () => {
  const parts = splitByReferences("before ${Postgres.DATABASE_URL} after", references);
  assert.deepEqual(
    parts.map((p) => p.value),
    ["before ", "${Postgres.DATABASE_URL}", " after"],
  );
  assert.equal(parts[1].reference?.id, "pg");
  assert.equal(parts[0].reference, null);
  assert.equal(parts[2].reference, null);
});

test("reference ranges point at the original string", () => {
  const value = "x ${Postgres.DATABASE_URL}";
  const parts = splitByReferences(value, references);
  assert.equal(value.slice(parts[1].from, parts[1].to), "${Postgres.DATABASE_URL}");
});

test("a source suffix is part of the reference", () => {
  const parts = splitByReferences("${Redis(2).URL}", references);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].reference?.id, "redis");
});

test("an unknown reference stays text", () => {
  const parts = splitByReferences("${Nope.MISSING}", references);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].reference, null);
  assert.equal(parts[0].value, "${Nope.MISSING}");
});

test("adjacent unknown references merge into one text part", () => {
  const parts = splitByReferences("${a}${b}", references);
  assert.deepEqual(
    parts.map((p) => p.value),
    ["${a}${b}"],
  );
});

test("a bare dollar is not a reference", () => {
  const parts = splitByReferences("costs $5 today", references);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].value, "costs $5 today");
});

test("parts always rebuild the original value", () => {
  for (const value of [
    "",
    "plain",
    "${Postgres.DATABASE_URL}",
    "a ${Postgres.DATABASE_URL} b ${Redis(2).URL}",
    "$ ${unknown} ${Redis(2).URL}",
    "multi\nline ${Postgres.DATABASE_URL}",
  ]) {
    const rebuilt = splitByReferences(value, references)
      .map((p) => p.value)
      .join("");
    assert.equal(rebuilt, value);
  }
});

test("a bare dollar opens the dropdown", () => {
  assert.deepEqual(resolveReferenceTarget("$", 1), { from: 0, to: 1 });
  assert.deepEqual(resolveReferenceTarget("prefix $", 8), { from: 7, to: 8 });
});

test("a dollar only counts with the cursor right after it", () => {
  // cursor before the $ in "a$b"
  assert.equal(resolveReferenceTarget("a$b", 1), null);
  // cursor after the b
  assert.equal(resolveReferenceTarget("a$b", 3), null);
});

test("typing past a dollar closes it again", () => {
  assert.equal(resolveReferenceTarget("$5", 2), null);
  assert.equal(resolveReferenceTarget("costs $5 today", 14), null);
});

test("completion opens inside a reference being typed", () => {
  assert.deepEqual(resolveReferenceTarget("${", 2), { from: 0, to: 2 });
  assert.deepEqual(resolveReferenceTarget("${Post", 6), { from: 0, to: 6 });
  assert.deepEqual(resolveReferenceTarget("value ${Post", 12), { from: 6, to: 12 });
});

test("completion stays shut once the reference is closed", () => {
  assert.equal(resolveReferenceTarget("${Postgres.DATABASE_URL}", 24), null);
  assert.equal(resolveReferenceTarget("${a}", 4), null);
});

test("completion stays shut in plain text", () => {
  assert.equal(resolveReferenceTarget("plain", 5), null);
  assert.equal(resolveReferenceTarget("", 0), null);
  assert.equal(resolveReferenceTarget("costs $5", 8), null);
});

test("a newline ends the reference being typed", () => {
  assert.equal(resolveReferenceTarget("${Post\nmore", 11), null);
});

test("the trigger button writes the trigger where there is none", () => {
  assert.deepEqual(resolveReferenceInsertion("", 0), { from: 0, to: 0, insert: "${" });
  assert.deepEqual(resolveReferenceInsertion("postgres://", 11), {
    from: 11,
    to: 11,
    insert: "${",
  });
  assert.deepEqual(resolveReferenceInsertion("abc def", 4), { from: 4, to: 4, insert: "${" });
});

test("the trigger button leaves a trigger that is already there alone", () => {
  assert.deepEqual(resolveReferenceInsertion("$", 1), { from: 1, to: 1, insert: "" });
  assert.deepEqual(resolveReferenceInsertion("${", 2), { from: 2, to: 2, insert: "" });
  assert.deepEqual(resolveReferenceInsertion("${Ap", 4), { from: 4, to: 4, insert: "" });
  assert.deepEqual(resolveReferenceInsertion("pre ${Ap", 8), { from: 8, to: 8, insert: "" });
});

test("the trigger button never writes into or against a finished reference", () => {
  const value = "${Api.PORT}";
  assert.deepEqual(resolveReferenceInsertion(value, 5), { from: 11, to: 11, insert: "${" });
  assert.deepEqual(resolveReferenceInsertion(value, 1), { from: 11, to: 11, insert: "${" });
  // straight before it the two would merge into one malformed reference
  assert.deepEqual(resolveReferenceInsertion(value, 0), { from: 11, to: 11, insert: "${" });
  assert.deepEqual(resolveReferenceInsertion("pre " + value, 4), {
    from: 15,
    to: 15,
    insert: "${",
  });
  // after it there is nothing to collide with
  assert.deepEqual(resolveReferenceInsertion(value, 11), { from: 11, to: 11, insert: "${" });
});

test("a reference being typed only covers what is behind the cursor", () => {
  // the node runs to the end of the line, but the text after the cursor is not
  // part of what is being matched, nor of what a pick replaces
  assert.deepEqual(resolveReferenceTarget("${ def", 2), { from: 0, to: 2 });
  assert.deepEqual(resolveReferenceTarget("abc${ def", 5), { from: 3, to: 5 });
  assert.deepEqual(resolveReferenceTarget("${Post more", 6), { from: 0, to: 6 });
});
