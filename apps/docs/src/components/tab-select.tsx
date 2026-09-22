import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname } from "fumadocs-core/framework";
import Link from "fumadocs-core/link";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { useTabsGroups, useTreeContext, useTreePath } from "fumadocs-ui/contexts/tree";
import { getLayoutTabs, isLayoutTabActive, type LayoutTab } from "fumadocs-ui/layouts/shared";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";

// Replaces the Fumadocs tab dropdown (Platform, Operations, API & MCP) with the
// app's dropdown. Rendered through the sidebar banner slot with layout tabs off.
export function TabSelect() {
  const { full } = useTreeContext();
  const tabs = useMemo(() => getLayoutTabs(full, { transform: (option) => option }), [full]);
  const groups = useTabsGroups(tabs);

  return groups.map((group, i) => <TabDropdown key={i} options={group.options} />);
}

function TabDropdown({ options }: { options: LayoutTab[] }) {
  const [open, setOpen] = useState(false);
  const { closeOnRedirect } = useSidebar();
  const pathname = usePathname();
  const path = useTreePath();

  const selected = useMemo(
    () => options.filter((item) => isLayoutTabActive(item, path, pathname)).at(-1),
    [options, path, pathname],
  );
  if (!selected) return null;

  function onSelect() {
    closeOnRedirect.current = false;
    setOpen(false);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            data-open={open || undefined}
            className="bg-input flex w-full flex-row items-center justify-start gap-2 rounded-lg border px-3 py-2.5 text-left"
          />
        }
      >
        <span className="flex size-4.5 shrink-0 items-center justify-center [&_svg]:size-full">
          {selected.icon}
        </span>
        <p className="min-w-0 flex-1 truncate font-medium">{selected.title}</p>
        <ChevronDownIcon className="text-muted-foreground -mr-0.75 size-5 transition group-data-open/button:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-(--anchor-width)">
        <DropdownMenuGroup>
          {options.map((item) => {
            const isActive = item.url === selected.url;
            if (!isActive && item.unlisted) return null;
            return (
              <DropdownMenuItem
                key={item.url}
                data-checked={isActive || undefined}
                className="group/item items-start"
                render={<Link href={item.url} onClick={onSelect} {...item.props} />}
              >
                <span className="flex size-4.5 shrink-0 items-center justify-center [&_svg]:size-full">
                  {item.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm leading-tight">{item.title}</span>
                  {item.description && (
                    <span className="text-muted-foreground text-xs leading-tight font-normal">
                      {item.description}
                    </span>
                  )}
                </span>
                <CheckIcon
                  strokeWidth={2.5}
                  className="-mr-0.5 size-4.5 shrink-0 opacity-0 group-data-checked/item:opacity-100"
                />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
