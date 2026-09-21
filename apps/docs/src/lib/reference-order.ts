import type { Source } from "fumadocs-core/source";

// Fumadocs lists reference groups and operations in path order, which is alphabetical.
// Groups follow the resource hierarchy instead, and operations read list, get, create,
// update, delete, then the rest. Within a verb the shortest name is the main operation.
const groupOrder = [
  "teams",
  "projects",
  "environments",
  "services",
  "service-groups",
  "users",
  "templates",
  "deployments",
  "changes",
  "variables",
  "storage",
  "replicas",
  "logs",
  "metrics",
  "servers",
  "docker",
  "unbind-webhooks",
];
const verbOrder = ["list", "get", "create", "update", "delete"];

function rank(order: string[], key: string) {
  const index = order.indexOf(key);
  return index === -1 ? order.length : index;
}

function sortBy(pages: string[], order: string[], keyOf: (page: string) => string) {
  return pages
    .map((page, index) => ({ page, index, key: rank(order, keyOf(page)) }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key - b.key;
      if (a.key < order.length) return a.page.length - b.page.length || a.index - b.index;
      return a.index - b.index;
    })
    .map((entry) => entry.page);
}

export function orderReference<S extends Source>(source: S, baseDir: string): S {
  for (const file of source.files) {
    if (file.type !== "meta" || !file.data.pages) continue;

    file.data.pages =
      file.path === `${baseDir}/meta.json`
        ? sortBy(file.data.pages, groupOrder, (page) => page)
        : sortBy(file.data.pages, verbOrder, (page) => page.split("-")[0]);
  }
  return source;
}
