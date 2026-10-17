import { matchesSearch, sortItems, type TListSort } from "@/lib/list-sort";
import type { TServiceShallow } from "@/lib/queries/services";

export type TServiceGroup = {
  group: NonNullable<TServiceShallow["service_group"]>;
  services: TServiceShallow[];
};

// The page lists blocks: services outside a group, and groups with their services
export type TServiceBlock =
  | { type: "service"; id: string; service: TServiceShallow }
  | ({ type: "service-group"; id: string } & TServiceGroup);

// Keeps the order services come in, a group sits where its first service is
export function toBlocks(services: TServiceShallow[]) {
  const blocks: TServiceBlock[] = [];
  const groups = new Map<string, TServiceGroup>();

  for (const service of services) {
    const group = service.service_group;
    if (!group) {
      blocks.push({ type: "service", id: service.id, service });
      continue;
    }
    const existing = groups.get(group.id);
    if (existing) {
      existing.services.push(service);
      continue;
    }
    const block = { type: "service-group" as const, id: group.id, group, services: [service] };
    groups.set(group.id, block);
    blocks.push(block);
  }

  return blocks;
}

export function flattenBlocks(blocks: TServiceBlock[]) {
  return blocks.flatMap((b) => (b.type === "service" ? [b.service] : b.services));
}

// A group whose name matches keeps all its services, otherwise only the matching ones
export function filterAndSortBlocks(blocks: TServiceBlock[], search: string, sort: TListSort) {
  const filtered = blocks.flatMap((block): TServiceBlock[] => {
    if (block.type === "service") return matchesSearch(block.service.name, search) ? [block] : [];
    if (matchesSearch(block.group.name, search)) return [block];
    const services = block.services.filter((s) => matchesSearch(s.name, search));
    return services.length > 0 ? [{ ...block, services }] : [];
  });

  return sortItems(filtered, sort, (b) => (b.type === "service" ? b.service : b.group)).map(
    (block) =>
      block.type === "service"
        ? block
        : { ...block, services: sortItems(block.services, sort, (s) => s) },
  );
}
