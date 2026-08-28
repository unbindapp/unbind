import assert from "node:assert/strict";
import { test } from "node:test";

import { logLineKey } from "./log-utils.ts";

test("logLineKey uses timestamp, pod and message", () => {
  const key = logLineKey({ timestamp: "t", pod_name: "p", message: "m" });
  assert.equal(key, "t#p#m");
  assert.notEqual(key, logLineKey({ timestamp: "t", pod_name: "p", message: "m2" }));
});

test("logLineKey tolerates missing timestamp", () => {
  assert.equal(logLineKey({ pod_name: "p", message: "m" }), "#p#m");
});




