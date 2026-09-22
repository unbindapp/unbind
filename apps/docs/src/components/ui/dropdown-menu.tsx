import { cn } from "@/lib/cn";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

// Same look and behaviour as apps/web/src/components/ui/dropdown-menu.tsx, animated
// with the Fumadocs keyframes the docs already ship.

function DropdownMenu({ highlightItemOnHover, ...props }: MenuPrimitive.Root.Props) {
  // A tap fires synthesized mouse events at the tap point, which would highlight
  // whichever item lands under the finger as the menu opens.
  const highlightOnHoverDefault =
    typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches;
  return (
    <MenuPrimitive.Root
      highlightItemOnHover={highlightItemOnHover ?? highlightOnHoverDefault}
      {...props}
    />
  );
}

function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger {...props} />;
}

function DropdownMenuContent({
  className,
  align = "start",
  side = "bottom",
  sideOffset = 4,
  collisionPadding = { top: 16, bottom: 16, left: 12, right: 12 },
  ...props
}: MenuPrimitive.Popup.Props &
  Pick<MenuPrimitive.Positioner.Props, "align" | "side" | "sideOffset" | "collisionPadding">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Backdrop className="fixed inset-0 z-998" />
      <MenuPrimitive.Positioner
        align={align}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className="isolate z-999 outline-none"
      >
        <MenuPrimitive.Popup
          className={cn(
            "bg-popover text-foreground shadow-shadow-color/shadow-opacity data-open:animate-fd-popover-in data-closed:animate-fd-popover-out flex max-h-[min(30rem,var(--available-height))] max-w-(--available-width) origin-(--transform-origin) flex-col overflow-hidden rounded-lg border p-0 shadow-lg outline-none",
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuGroup({ className, ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group className={cn("p-1", className)} {...props} />;
}

function DropdownMenuItem({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "active:bg-accent data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center justify-start gap-2.5 rounded-md px-3 py-2.5 leading-tight font-medium outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&>svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
};
