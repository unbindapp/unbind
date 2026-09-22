import { cn } from "@/lib/cn";
import { usePathname } from "fumadocs-core/framework";
import Link from "fumadocs-core/link";
import type * as PageTree from "fumadocs-core/page-tree";
import { useTreeContext } from "fumadocs-ui/contexts/tree";
import type { FooterProps } from "fumadocs-ui/layouts/docs/page/slots/footer";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo } from "react";

type Item = Pick<PageTree.Item, "name" | "description" | "url">;

function flattenPages(root: Pick<PageTree.Root, "children">) {
  const list: PageTree.Item[] = [];
  function visit(node: PageTree.Node) {
    if (node.type === "folder") {
      if (node.index) visit(node.index);
      node.children.forEach(visit);
      return;
    }
    if (node.type === "page" && !node.external) list.push(node);
  }
  root.children.forEach(visit);
  return list;
}

function normalize(url: string) {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}

// Previous and next page links with the app's card hover and active states.
export function PageFooter({ items, className, children, ...props }: FooterProps) {
  const { root } = useTreeContext();
  const pathname = usePathname();

  const { previous, next } = useMemo(() => {
    if (items) return items;
    const list = flattenPages(root);
    const idx = list.findIndex((item) => normalize(item.url) === normalize(pathname));
    if (idx === -1) return {};
    return { previous: list[idx - 1], next: list[idx + 1] };
  }, [items, root, pathname]);

  return (
    <>
      <div
        className={cn(
          "@container grid gap-4",
          previous && next ? "grid-cols-2" : "grid-cols-1",
          className,
        )}
        {...props}
      >
        {previous && <FooterItem item={previous} direction="previous" />}
        {next && <FooterItem item={next} direction="next" />}
      </div>
      {children}
    </>
  );
}

function FooterItem({ item, direction }: { item: Item; direction: "previous" | "next" }) {
  const isNext = direction === "next";
  const Icon = isNext ? ChevronRightIcon : ChevronLeftIcon;

  return (
    <Link
      href={item.url}
      className={cn(
        "bg-card has-hover:hover:bg-card-hover active:bg-card-hover focus-visible:ring-primary/8-10 flex flex-col gap-1 rounded-xl border p-4 text-sm focus-visible:ring-1 focus-visible:outline-hidden @max-lg:col-span-full",
        isNext && "text-end",
      )}
    >
      <div
        className={cn("inline-flex items-center gap-1.5 font-medium", isNext && "flex-row-reverse")}
      >
        <Icon className="-mx-1 size-4 shrink-0" />
        <p>{item.name}</p>
      </div>
      <p className="text-muted-foreground truncate">
        {item.description ?? (isNext ? "Next Page" : "Previous Page")}
      </p>
    </Link>
  );
}
