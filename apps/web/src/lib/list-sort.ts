import { z } from "zod";

export const ListSortEnum = z.enum([
  "custom",
  "created_desc",
  "created_asc",
  "name_asc",
  "name_desc",
]);
export type TListSort = z.infer<typeof ListSortEnum>;

export const defaultListSort: TListSort = "custom";

export const listSorts: { value: TListSort; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "created_desc", label: "Newest First" },
  { value: "created_asc", label: "Oldest First" },
  { value: "name_asc", label: "A → Z" },
  { value: "name_desc", label: "Z → A" },
];

type TSortable = { name: string; created_at: string };
type TComparator = (a: TSortable, b: TSortable) => number;

const byCreated: TComparator = (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at);
const byName: TComparator = (a, b) => a.name.localeCompare(b.name);

// Custom is the order the API returns
const comparators: Record<TListSort, TComparator | null> = {
  custom: null,
  created_desc: (a, b) => byCreated(b, a),
  created_asc: byCreated,
  name_asc: byName,
  name_desc: (a, b) => byName(b, a),
};

export function sortItems<T>(items: T[], sort: TListSort, key: (item: T) => TSortable) {
  const compare = comparators[sort];
  if (!compare) return items;
  return items.toSorted((a, b) => compare(key(a), key(b)));
}

export function matchesSearch(name: string, search: string) {
  const query = search.trim().toLowerCase();
  return query === "" || name.toLowerCase().includes(query);
}
