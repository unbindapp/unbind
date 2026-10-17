import assert from "node:assert/strict";
import { test } from "node:test";

import { searchItems } from "./network-search.ts";

const items = [
  { label: "Server", description: "Appditto / Natrium / production" },
  { label: "Redis", description: "Appditto / Natrium / production" },
  { label: "Server", description: "Appditto / Natricon / production" },
  { label: "natricon-proxy", description: "Banano / Utils / production" },
  { label: "Natricon", description: "Banano / Utils / production" },
  { label: "Web", description: "Appditto / Natricon / production" },
];

const labels = (found: typeof items) => found.map((item) => `${item.label} (${item.description})`);

test("matches whole words, not letters spread over the path", () => {
  assert.deepEqual(labels(searchItems(items, "natricon")), [
    "Natricon (Banano / Utils / production)",
    "natricon-proxy (Banano / Utils / production)",
    "Server (Appditto / Natricon / production)",
    "Web (Appditto / Natricon / production)",
  ]);
});

test("every word has to match, in the name or the path", () => {
  assert.deepEqual(labels(searchItems(items, "natricon server")), [
    "Server (Appditto / Natricon / production)",
  ]);
  assert.deepEqual(labels(searchItems(items, "natrium server")), [
    "Server (Appditto / Natrium / production)",
  ]);
  assert.deepEqual(searchItems(items, "pippin"), []);
});

test("an empty search keeps every item in order", () => {
  assert.deepEqual(searchItems(items, "  "), items);
});
