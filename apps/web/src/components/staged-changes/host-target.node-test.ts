import assert from "node:assert/strict";
import { test } from "node:test";

import {
  headerLines,
  hostTargetFromSpec,
  hostTargetToSpec,
  hostTargetsEqual,
  parseHeaderLine,
} from "./host-target.ts";

test("hostTargetFromSpec fills the redirect status the API left out", () => {
  const target = hostTargetFromSpec({
    host: "www.example.com",
    path: "/",
    target_port: 3000,
    redirect: { to: "https://example.com" },
  });
  assert.deepEqual(target, {
    host: "www.example.com",
    port: 3000,
    redirect: { to: "https://example.com", statusCode: 308 },
  });
});

test("hostTargetsEqual compares every option, treating empty as unset", () => {
  const saved = hostTargetFromSpec({
    host: "app.example.com",
    path: "/",
    target_port: 3000,
    response_headers: [{ name: "Cache-Control", value: "no-store" }],
  });
  assert.ok(
    hostTargetsEqual(saved, {
      host: "app.example.com",
      port: 3000,
      responseHeaders: [{ name: "Cache-Control", value: "no-store" }],
    }),
  );
  assert.ok(!hostTargetsEqual(saved, { host: "app.example.com", port: 3000 }));
  assert.ok(!hostTargetsEqual(saved, { ...saved, basicAuth: { username: "admin" } }));
  // The server never returns the password, so a staged one still matches once applied
  assert.ok(
    hostTargetsEqual(
      { ...saved, basicAuth: { username: "admin" } },
      { ...saved, basicAuth: { username: "admin", password: "secret" } },
    ),
  );
  assert.ok(
    !hostTargetsEqual(saved, { ...saved, redirect: { to: "https://x.com", statusCode: 301 } }),
  );
  assert.ok(!hostTargetsEqual(saved, { ...saved, proxy: { to: "https://x.com/install.sh" } }));
});

test("a proxy round trips between the spec and the staged target", () => {
  const spec = {
    host: "install.example.com",
    path: "",
    target_port: undefined,
    prev_host: undefined,
    proxy: { to: "https://raw.githubusercontent.com/org/repo/main/install.sh" },
  };
  const target = hostTargetFromSpec(spec);
  assert.deepEqual(target.proxy, spec.proxy);
  assert.deepEqual(hostTargetToSpec(target), spec);
});

test("header lines round trip through parseHeaderLine", () => {
  const headers = [
    { name: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  ];
  const [line] = headerLines(headers);
  assert.equal(line, "Strict-Transport-Security: max-age=31536000; includeSubDomains");
  assert.deepEqual(parseHeaderLine(line), headers[0]);
  assert.equal(parseHeaderLine("no colon"), null);
  assert.equal(parseHeaderLine(": value"), null);
  assert.equal(parseHeaderLine("Name:   "), null);
  assert.equal(parseHeaderLine("Bad Name: x"), null);
});
