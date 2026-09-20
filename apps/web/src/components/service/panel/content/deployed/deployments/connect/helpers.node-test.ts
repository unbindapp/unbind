import assert from "node:assert/strict";
import { test } from "node:test";

import { connectionUrls, hasMultipleUrls, maskUrlPassword, variableNameFor } from "./helpers.ts";

const provided = (name: string, value: string) => ({ name, value, provided: true });

test("connection urls are split by network and keep the primary protocol first", () => {
  const urls = connectionUrls([
    provided("UNBIND_DATABASE_URL_PRIVATE_HTTP", "http://private-http"),
    provided("UNBIND_DATABASE_URL_PUBLIC", "clickhouse://public"),
    provided("UNBIND_DATABASE_URL_PRIVATE", "clickhouse://private"),
    provided("UNBIND_HOST_PRIVATE", "db.ns.svc.cluster.local"),
    { name: "UNBIND_DATABASE_URL_PUBLIC_HTTP", value: "user-made", provided: false },
  ]);

  assert.deepEqual(urls.private, [
    { key: "UNBIND_DATABASE_URL_PRIVATE", label: undefined, value: "clickhouse://private" },
    { key: "UNBIND_DATABASE_URL_PRIVATE_HTTP", label: "HTTP", value: "http://private-http" },
  ]);
  assert.deepEqual(urls.public, [
    { key: "UNBIND_DATABASE_URL_PUBLIC", label: undefined, value: "clickhouse://public" },
  ]);
});

test("a private database has no public urls", () => {
  const urls = connectionUrls([provided("UNBIND_DATABASE_URL_PRIVATE", "redis://private")]);
  assert.deepEqual(urls.public, []);
});

test("only the password of a connection url is masked", () => {
  assert.equal(
    maskUrlPassword("postgresql://postgres:s3cr%40t@1.2.3.4:31544/primarydb?sslmode=disable"),
    "postgresql://postgres:••••••••@1.2.3.4:31544/primarydb?sslmode=disable",
  );
  assert.equal(
    maskUrlPassword("redis://default:pw@[2001:db8::1]:6379"),
    "redis://default:••••••••@[2001:db8::1]:6379",
  );
});

test("a value without a recognizable password is masked entirely", () => {
  assert.equal(maskUrlPassword("not a url with secret"), "••••••••");
  assert.equal(maskUrlPassword("postgresql://host:5432/db"), "••••••••");
});

test("only engines with more than one protocol offer a choice of urls", () => {
  assert.equal(hasMultipleUrls("clickhouse"), true);
  assert.equal(hasMultipleUrls("postgres"), false);
  assert.equal(hasMultipleUrls(""), false);
});

test("the variable name follows the engine and carries the protocol", () => {
  assert.equal(variableNameFor("postgres"), "DATABASE_URL");
  assert.equal(variableNameFor("mysql"), "DATABASE_URL");
  assert.equal(variableNameFor("redis"), "REDIS_URL");
  assert.equal(variableNameFor("mongodb"), "MONGO_URL");
  assert.equal(variableNameFor("clickhouse"), "CLICKHOUSE_URL");
  assert.equal(variableNameFor("clickhouse", "HTTP"), "CLICKHOUSE_HTTP_URL");
});

test("an unknown engine still gets a usable name", () => {
  assert.equal(variableNameFor("cockroach"), "DATABASE_URL");
  assert.equal(variableNameFor("cockroach", "grpc web"), "DATABASE_GRPC_WEB_URL");
});
