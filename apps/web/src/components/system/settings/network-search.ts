export type TSearchableItem = {
  label: string;
  description?: string;
};

export function searchItems<T extends TSearchableItem>(items: T[], search: string): T[] {
  const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return items;

  return items
    .map((item, index) => ({ item, index, rank: rankItem(item, tokens) }))
    .filter((ranked): ranked is { item: T; index: number; rank: number } => ranked.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((ranked) => ranked.item);
}

function rankItem(item: TSearchableItem, tokens: string[]): number | null {
  const name = item.label.toLowerCase();
  const haystack = `${name} ${item.description?.toLowerCase() ?? ""}`;
  if (!tokens.every((token) => haystack.includes(token))) return null;

  const query = tokens.join(" ");
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (tokens.some((token) => name.includes(token))) return 3;
  return 4;
}
