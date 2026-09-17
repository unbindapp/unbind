import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { z } from "zod";

import {
  readDraft,
  removeDraft,
  removeDraftWithViewState,
  writeDraft,
} from "./form-draft-storage.ts";

const prefix = "unbind-form-draft:";

function createStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
  };
}

let storage: Storage;

beforeEach(() => {
  storage = createStorage();
  Object.assign(globalThis, { window: { sessionStorage: storage, localStorage: createStorage() } });
});

const ValuesSchema = z.object({ name: z.string() });

test("write and read round-trip", () => {
  writeDraft({ type: "session", key: "form" }, { name: "a" });
  assert.deepEqual(readDraft({ type: "session", key: "form", schema: ValuesSchema }), {
    name: "a",
  });

  writeDraft({ type: "session", key: "form:open" }, true);
  assert.equal(readDraft({ type: "session", key: "form:open", schema: z.boolean() }), true);
});

test("session and local storage are separate", () => {
  writeDraft({ type: "session", key: "form" }, { name: "a" });
  assert.equal(readDraft({ type: "local", key: "form", schema: ValuesSchema }), undefined);
});

test("read drops entries that fail the schema", () => {
  writeDraft({ type: "session", key: "form" }, { name: 1 });
  assert.equal(readDraft({ type: "session", key: "form", schema: ValuesSchema }), undefined);
  assert.equal(storage.getItem(prefix + "form"), null);
});

test("read drops entries with another version or a broken envelope", () => {
  storage.setItem(prefix + "old", JSON.stringify({ version: -1, values: { name: "a" } }));
  storage.setItem(prefix + "bare", JSON.stringify({ name: "a" }));
  storage.setItem(prefix + "garbage", "{not json");

  for (const key of ["old", "bare", "garbage"]) {
    assert.equal(readDraft({ type: "session", key, schema: ValuesSchema }), undefined);
  }
  assert.equal(storage.getItem(prefix + "old"), null);
  assert.equal(storage.getItem(prefix + "bare"), null);
});

test("removeDraft leaves view state in place", () => {
  writeDraft({ type: "session", key: "form" }, { name: "a" });
  writeDraft({ type: "session", key: "form:open" }, true);

  removeDraft({ type: "session", key: "form" });

  assert.equal(storage.getItem(prefix + "form"), null);
  assert.equal(readDraft({ type: "session", key: "form:open", schema: z.boolean() }), true);
});

test("removeDraftWithViewState clears the namespace and nothing else", () => {
  for (const key of ["form", "form:open", "form:advanced-settings", "form-2", "form-2:open"]) {
    writeDraft({ type: "session", key }, true);
  }
  storage.setItem("unrelated", "1");

  removeDraftWithViewState({ type: "session", key: "form" });

  const remaining = Array.from({ length: storage.length }, (_, i) => storage.key(i)).sort();
  assert.deepEqual(remaining, [prefix + "form-2", prefix + "form-2:open", "unrelated"]);
});
