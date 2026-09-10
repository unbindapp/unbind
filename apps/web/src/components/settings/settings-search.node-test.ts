import assert from "node:assert/strict";
import { test } from "node:test";

import { settingsIds } from "./settings-ids.ts";
import { matchSettings, settingsSearchIndex } from "./settings-search.ts";

function visibleItems(query: string) {
  const matches = matchSettings(query);
  assert.ok(matches, `expected matches for "${query}"`);
  const ids: string[] = [];
  for (const section of settingsSearchIndex) {
    for (const item of section.items) {
      if (matches.sections.has(section.id) || matches.items.has(item.id)) ids.push(item.id);
    }
  }
  return ids;
}

test("every settings id is in the search index", () => {
  const indexed = new Set(settingsSearchIndex.flatMap((s) => s.items.map((i) => i.id)));
  for (const items of Object.values(settingsIds)) {
    for (const id of Object.values(items)) {
      assert.ok(indexed.has(id), `${id} is missing from the search index`);
    }
  }
});

test("a blank query shows everything", () => {
  assert.equal(matchSettings(""), null);
  assert.equal(matchSettings("   "), null);
});

test("an item query narrows a section to that item", () => {
  assert.deepEqual(visibleItems("Repository"), [settingsIds.source.repository]);
  assert.deepEqual(visibleItems("builder"), [settingsIds.build.builder]);
  assert.deepEqual(visibleItems("resource limits"), [settingsIds.deploy.resourceLimits]);
});

test("a section query shows the whole section", () => {
  const matches = matchSettings("networking");
  assert.ok(matches);
  assert.ok(matches.sections.has("networking"));
  assert.deepEqual(
    visibleItems("Build"),
    settingsSearchIndex.find((s) => s.id === "build")!.items.map((i) => i.id),
  );
});

test("keywords match", () => {
  assert.ok(visibleItems("dns").includes(settingsIds.networking.public));
  assert.ok(visibleItems("url").includes(settingsIds.networking.private));
  assert.ok(visibleItems("ram").includes(settingsIds.deploy.resourceLimits));
  assert.ok(visibleItems("cron").includes(settingsIds.backups.schedule));
  assert.ok(matchSettings("remove")?.sections.has("danger"));
});

test("typos still match", () => {
  assert.ok(visibleItems("repositry").includes(settingsIds.source.repository));
  assert.ok(matchSettings("helth")?.sections.has("health"));
});

test("description words match only when nothing else does", () => {
  assert.deepEqual(visibleItems("internet"), [settingsIds.networking.public]);
  assert.ok(!visibleItems("Repository").includes(settingsIds.build.dockerfilePath));
});

test("unrelated queries do not match", () => {
  assert.equal(visibleItems("zzzz").length, 0);
  assert.ok(!visibleItems("port").includes(settingsIds.source.repository));
  assert.ok(!visibleItems("dns").includes(settingsIds.build.builder));
});

test("a case-insensitive query matches", () => {
  assert.deepEqual(visibleItems("REPOSITORY"), [settingsIds.source.repository]);
});
