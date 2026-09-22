import { Button } from "@/components/ui/button";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { SidebarIcon } from "lucide-react";
import type { ComponentProps } from "react";

// The mobile header's sidebar toggle. Fumadocs passes its own button classes and icon
// in, both are replaced with ours.
export function SidebarTrigger({
  className: _className,
  children: _children,
  ...props
}: ComponentProps<"button">) {
  const { open, setOpen } = useSidebar();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={open ? "Close sidebar" : "Open sidebar"}
      aria-expanded={open}
      aria-controls="nd-sidebar-mobile"
      onClick={() => setOpen((prev) => !prev)}
      className="text-muted-foreground"
      {...props}
    >
      <SidebarIcon className="size-5" />
    </Button>
  );
}
