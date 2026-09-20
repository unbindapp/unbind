import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getTakenNameError,
  getUniqueName,
  isNameTaken,
  uniqueNameMaxLength,
} from "./unique-name.ts";

test("names are compared trimmed and case sensitive", () => {
  assert.equal(isNameTaken("bio", ["bio"]), true);
  assert.equal(isNameTaken("  bio ", ["bio"]), true);
  assert.equal(isNameTaken("Bio", ["bio"]), false);
  assert.equal(isNameTaken("bio", []), false);
});

test("a typed name that is taken is an error", () => {
  const uniqueAmong = { names: ["bio", "api"], entity: "a service" };
  assert.deepEqual(getTakenNameError(" api ", uniqueAmong), {
    message: "There is already a service with this name.",
  });
  assert.equal(getTakenNameError("Api", uniqueAmong), undefined);
  assert.equal(getTakenNameError("api", undefined), undefined);
});

test("an entity can keep its own name", () => {
  const uniqueAmong = { names: ["bio", "api"], entity: "a service" };
  assert.equal(getTakenNameError("bio", uniqueAmong, "bio"), undefined);
  assert.notEqual(getTakenNameError("api", uniqueAmong, "bio"), undefined);
});

test("a free name is kept", () => {
  assert.equal(getUniqueName("bio", ["Bio", "other"]), "bio");
});

test("a taken name gets a 4 character suffix", () => {
  assert.match(getUniqueName("PostgreSQL", ["PostgreSQL"]), /^PostgreSQL-[a-zA-Z0-9]{4}$/);
});

test("a free name that is too long is cut to the limit", () => {
  const name = getUniqueName("a".repeat(50), []);
  assert.equal(name, "a".repeat(uniqueNameMaxLength));
});

test("a long taken name is cut so the suffix fits", () => {
  const long = "a".repeat(uniqueNameMaxLength);
  const name = getUniqueName(long, [long]);
  assert.match(name, new RegExp(`^a{${uniqueNameMaxLength - 5}}-[a-zA-Z0-9]{4}$`));
});

test("the cut does not leave a dangling separator", () => {
  const long = `${"a".repeat(uniqueNameMaxLength - 6)}-${"b".repeat(5)}`;
  assert.match(
    getUniqueName(long, [long]),
    new RegExp(`^a{${uniqueNameMaxLength - 6}}-[a-zA-Z0-9]{4}$`),
  );
});

test("multibyte names are cut by character", () => {
  const long = "ü".repeat(uniqueNameMaxLength);
  assert.equal(Array.from(getUniqueName(long, [long])).length, uniqueNameMaxLength);
});

test("the suffixed name is never a taken one", () => {
  const taken = ["bio"];
  for (let i = 0; i < 200; i++) {
    const name = getUniqueName("bio", taken);
    assert.equal(taken.includes(name), false);
    taken.push(name);
  }
});
