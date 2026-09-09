import assert from "node:assert/strict";
import { test } from "node:test";

import { getMountPathError, MountPathSchema } from "./mount-path.ts";

test("accepts absolute unix paths", () => {
  for (const path of ["/", "/data", "/var/lib/app", "/a-b_c.d"]) {
    assert.equal(getMountPathError(path), null, path);
  }
});

test("explains relative, windows and malformed paths", () => {
  const cases: [string, string][] = [
    ["", 'Path should start with "/"'],
    ["data", 'Path should start with "/"'],
    ["./data", 'Path should start with "/"'],
    ["/C:\\data", "Path can't contain backslashes"],
    ["/data//logs", "Path can't contain consecutive slashes"],
    ["/da:ta", "Path can't contain :"],
    ["/a?b", "Path can't contain ?"],
    ["/a*", "Path can't contain *"],
    ["/<a>", "Path can't contain <"],
    ["/a|b", "Path can't contain |"],
    ['/a"b', `Path can't contain "`],
  ];
  for (const [path, error] of cases) {
    assert.equal(getMountPathError(path), error, path);
  }
});

test("schema reports the same message", () => {
  assert.equal(MountPathSchema.safeParse("/data").success, true);
  const result = MountPathSchema.safeParse("data");
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0]?.message, 'Path should start with "/"');
});
