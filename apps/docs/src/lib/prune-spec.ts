import type { OpenAPIPageProps_Spec } from "fumadocs-openapi/server";

type Spec = OpenAPIPageProps_Spec["payload"]["bundled"];
type Components = Record<string, Record<string, unknown>>;

const componentRef = /^#\/components\/([^/]+)\/([^/]+)$/;

// Every API page embeds its spec, so keep only what the page's operations use.
export function pruneSpec(spec: Spec, operations: { path: string; method: string }[]): Spec {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const { path, method } of operations) {
    const item = spec.paths?.[path] as Record<string, unknown> | undefined;
    if (!item) continue;
    paths[path] = { ...paths[path], [method]: item[method] };
  }

  const source = (spec.components ?? {}) as Components;
  const components: Components = { securitySchemes: source.securitySchemes ?? {} };
  const pending: unknown[] = [paths];

  while (pending.length > 0) {
    const node = pending.pop();
    if (typeof node !== "object" || node === null) continue;

    for (const [key, value] of Object.entries(node)) {
      const match = key === "$ref" && typeof value === "string" ? componentRef.exec(value) : null;
      if (!match) {
        pending.push(value);
        continue;
      }

      const [, section, name] = match;
      if (components[section]?.[name] !== undefined) continue;
      components[section] = { ...components[section], [name]: source[section]?.[name] };
      pending.push(source[section]?.[name]);
    }
  }

  return { ...spec, paths, components } as Spec;
}
