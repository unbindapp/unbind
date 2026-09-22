import { cn } from "@/lib/cn";
import type * as PageTree from "fumadocs-core/page-tree";
import { usePathname } from "fumadocs-core/framework";
import {
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
  SidebarSeparator,
  useFolder,
  useFolderDepth,
} from "fumadocs-ui/components/sidebar/base";
import { useTreePath } from "fumadocs-ui/contexts/tree";
import type { ReactNode } from "react";
import type { SidebarPageTreeComponents } from "fumadocs-ui/components/sidebar/page-tree";

// The sidebar page tree with the app's hover and active states. Layout and depth
// offsets are the same as the Fumadocs defaults.

const itemClass =
  "relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-muted-foreground wrap-anywhere focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary/8-10 [&_svg]:size-4 [&_svg]:shrink-0";
const idleClass =
  "has-hover:hover:bg-border has-hover:hover:text-foreground active:bg-border active:text-foreground";
const activeClass = "bg-success/2-10 text-success";
const highlightClass =
  "before:content-[''] before:bg-success before:absolute before:w-px before:inset-y-2.5 before:inset-s-2.5";

function normalize(url: string) {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}

function isActive(url: string, pathname: string) {
  return normalize(url) === normalize(pathname);
}

function itemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

function Item({ item }: { item: PageTree.Item }) {
  const pathname = usePathname();
  const depth = useFolderDepth();
  const active = isActive(item.url, pathname);

  return (
    <SidebarItem
      href={item.url}
      external={item.external}
      active={active}
      icon={item.icon}
      className={cn(itemClass, active ? [activeClass, depth >= 1 && highlightClass] : idleClass)}
      style={{ paddingInlineStart: itemOffset(depth) }}
    >
      {item.name}
    </SidebarItem>
  );
}

function FolderTrigger({ children }: { children: ReactNode }) {
  const folder = useFolder();
  const depth = useFolderDepth();
  return (
    <SidebarFolderTrigger
      className={cn(itemClass, "w-full", folder?.collapsible && idleClass)}
      style={{ paddingInlineStart: itemOffset(depth - 1) }}
    >
      {children}
    </SidebarFolderTrigger>
  );
}

function FolderLink({ item, active }: { item: PageTree.Folder; active: boolean }) {
  const depth = useFolderDepth();
  if (!item.index) return null;

  return (
    <SidebarFolderLink
      href={item.index.url}
      external={item.index.external}
      active={active}
      className={cn(
        itemClass,
        "w-full",
        active ? [activeClass, depth > 1 && highlightClass] : idleClass,
      )}
      style={{ paddingInlineStart: itemOffset(depth - 1) }}
    >
      {item.icon}
      {item.name}
    </SidebarFolderLink>
  );
}

function FolderContent({ children }: { children: ReactNode }) {
  const depth = useFolderDepth();
  return (
    <SidebarFolderContent
      className={cn(
        "relative flex flex-col gap-0.5 pt-0.5",
        depth === 1 &&
          "before:bg-border before:absolute before:inset-y-1 before:inset-s-2.5 before:w-px before:content-['']",
      )}
    >
      {children}
    </SidebarFolderContent>
  );
}

function Folder({ item, children }: { item: PageTree.Folder; children: ReactNode }) {
  const pathname = usePathname();
  const path = useTreePath();
  const indexActive = item.index ? isActive(item.index.url, pathname) : false;

  return (
    <SidebarFolder
      collapsible={item.collapsible}
      active={path.includes(item)}
      defaultOpen={item.defaultOpen}
    >
      {item.index ? (
        <FolderLink item={item} active={indexActive} />
      ) : (
        <FolderTrigger>
          {item.icon}
          {item.name}
        </FolderTrigger>
      )}
      <FolderContent>{children}</FolderContent>
    </SidebarFolder>
  );
}

function Separator({ item }: { item: PageTree.Separator }) {
  const depth = useFolderDepth();
  return (
    <SidebarSeparator
      className={cn(
        "mt-6 mb-1 inline-flex items-center gap-2 px-2 font-semibold empty:mb-0 [&_svg]:size-4 [&_svg]:shrink-0",
        depth === 0 && "first:mt-0",
      )}
      style={{ paddingInlineStart: itemOffset(depth) }}
    >
      {item.icon}
      {item.name}
    </SidebarSeparator>
  );
}

export const sidebarComponents: SidebarPageTreeComponents = { Item, Folder, Separator };
