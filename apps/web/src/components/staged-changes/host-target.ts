// Relative imports so this can run under `node --test`.
import type { HostSpec } from "../../lib/server/client.gen.ts";
import type { THostTarget } from "./types.ts";

export const defaultRedirectStatusCode = 308;
export const redirectStatusCodes = [301, 302, 307, 308] as const;

// The path prefix a domain answers on, / for the whole domain
export function routePath(path: string | undefined) {
  const trimmed = path?.endsWith("/") ? path.slice(0, -1) : (path ?? "");
  return trimmed === "" ? "/" : trimmed;
}

// One host can route several paths, so a domain is its host and path
export function sameRoute(
  a: Pick<THostTarget, "host" | "path">,
  b: Pick<THostTarget, "host" | "path">,
) {
  return a.host === b.host && routePath(a.path) === routePath(b.path);
}

// The domain as visitors type it, with the path unless it is the whole domain
export function routeLabel({ host, path }: Pick<THostTarget, "host" | "path">) {
  const prefix = routePath(path);
  return prefix === "/" ? host : host + prefix;
}

// A saved domain as the staged changes see it
export function hostTargetFromSpec(spec: HostSpec): THostTarget {
  const target: THostTarget = { host: spec.host, port: spec.target_port };
  if (routePath(spec.path) !== "/") target.path = spec.path;
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

export function hostTargetToSpec(target: THostTarget, previous?: THostTarget | null): HostSpec {
  const spec: HostSpec = {
    host: target.host,
    path: target.path ?? "",
    target_port: target.port,
    prev_host: previous?.host,
    prev_path: previous ? (previous.path ?? "") : undefined,
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
    sameRoute(a, b) &&
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
