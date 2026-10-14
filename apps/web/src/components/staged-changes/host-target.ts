// Relative imports so this can run under `node --test`.
import type { HostSpec } from "../../lib/server/client.gen.ts";
import type { THostTarget } from "./types.ts";

export const defaultRedirectStatusCode = 308;
export const redirectStatusCodes = [301, 302, 307, 308] as const;

// A saved domain as the staged changes see it
export function hostTargetFromSpec(spec: HostSpec): THostTarget {
  const target: THostTarget = { host: spec.host, port: spec.target_port };
  if (spec.redirect) {
    target.redirect = {
      to: spec.redirect.to,
      statusCode: spec.redirect.status_code ?? defaultRedirectStatusCode,
    };
  }
  if (spec.proxy) target.proxy = { to: spec.proxy.to };
  if (spec.basic_auth) target.basicAuth = { username: spec.basic_auth.username };
  if (spec.response_headers && spec.response_headers.length > 0) {
    target.responseHeaders = spec.response_headers.map((h) => ({ name: h.name, value: h.value }));
  }
  return target;
}

export function hostTargetToSpec(target: THostTarget, prevHost?: string): HostSpec {
  const spec: HostSpec = {
    host: target.host,
    path: "",
    target_port: target.port,
    prev_host: prevHost,
  };
  if (target.redirect) {
    spec.redirect = {
      to: target.redirect.to,
      status_code: redirectStatusCodes.find((code) => code === target.redirect?.statusCode),
    };
  }
  if (target.proxy) spec.proxy = { to: target.proxy.to };
  if (target.basicAuth) {
    spec.basic_auth = { username: target.basicAuth.username, password: target.basicAuth.password };
  }
  if (target.responseHeaders && target.responseHeaders.length > 0) {
    spec.response_headers = target.responseHeaders.map((h) => ({ name: h.name, value: h.value }));
  }
  return spec;
}

// A password is never read back, so two targets with the same username are the same
// domain as far as the server can tell
export function hostTargetsEqual(a: THostTarget, b: THostTarget) {
  return (
    a.host === b.host &&
    a.port === b.port &&
    a.redirect?.to === b.redirect?.to &&
    a.redirect?.statusCode === b.redirect?.statusCode &&
    a.proxy?.to === b.proxy?.to &&
    a.basicAuth?.username === b.basicAuth?.username &&
    headerLines(a.responseHeaders).join("\n") === headerLines(b.responseHeaders).join("\n")
  );
}

// "Name: value" lines, the shape the headers are typed in
export function headerLines(headers: THostTarget["responseHeaders"]) {
  return (headers ?? []).map((h) => `${h.name}: ${h.value}`);
}

// Returns null for a line that is not "Name: value"
export function parseHeaderLine(line: string) {
  const colon = line.indexOf(":");
  if (colon < 1) return null;
  const name = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (!/^[A-Za-z0-9-]+$/.test(name) || value === "") return null;
  return { name, value };
}
