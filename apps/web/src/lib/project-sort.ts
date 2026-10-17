import type { TProjectShallow } from "@/lib/queries/projects";
import { z } from "zod";

export const ProjectSortEnum = z.enum(["custom", "name_asc", "name_desc", "newest", "oldest"]);
export type TProjectSort = z.infer<typeof ProjectSortEnum>;

export const defaultProjectSort: TProjectSort = "custom";

export const projectSorts: { value: TProjectSort; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name_asc", label: "A → Z" },
  { value: "name_desc", label: "Z → A" },
];

const byCreated = (a: TProjectShallow, b: TProjectShallow) =>
  Date.parse(a.created_at) - Date.parse(b.created_at);
const byName = (a: TProjectShallow, b: TProjectShallow) => a.name.localeCompare(b.name);

const comparators: Record<
  TProjectSort,
  ((a: TProjectShallow, b: TProjectShallow) => number) | null
> = {
  custom: null,
  name_asc: byName,
  name_desc: (a, b) => byName(b, a),
  newest: (a, b) => byCreated(b, a),
  oldest: byCreated,
};

export function filterAndSortProjects(
  projects: TProjectShallow[],
  { search, sort }: { search: string; sort: TProjectSort },
) {
  const query = search.trim().toLowerCase();
  const filtered = query
    ? projects.filter((p) => p.name.toLowerCase().includes(query))
    : [...projects];

  const compare = comparators[sort];
  if (!compare) return filtered;
  return filtered.sort(compare);
}
