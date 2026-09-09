import { getContextCommandPanelId } from "@/components/command-panel/constants";
import { TContextCommandPanelContext } from "@/components/command-panel/types";
import { useSetCommandPanelId } from "@/components/command-panel/use-command-panel";
import KeyboardShortcut from "@/components/keyboard-shortcut";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { detectPlatform, formatForDisplay } from "@tanstack/react-hotkeys";
import { SearchIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  contextType: Extract<TContextCommandPanelContext["contextType"], "team" | "project">;
  className?: string;
};

export default function NavbarSearchButton({ contextType, className }: TProps) {
  const { isExtraSmall } = useDeviceSize();
  const setPanelId = useSetCommandPanelId();
  const shortcut = useMemo(
    () =>
      formatForDisplay("Mod+K", {
        separatorToken: detectPlatform() === "mac" ? "" : undefined,
      }),
    [],
  );

  return (
    <Button
      type="button"
      aria-label="Search"
      variant="outline-muted"
      size="sm"
      focusVariant="input-like"
      onClick={() => setPanelId(getContextCommandPanelId(contextType, "layout"))}
      className={cn(
        "text-muted-foreground bg-input has-hover:hover:text-muted-foreground active:text-muted-foreground gap-1.5 rounded-full py-1.25 font-medium",
        isExtraSmall ? "size-8 px-0" : "w-40 justify-start pr-1.25 pl-2.5 lg:w-48",
        className,
      )}
    >
      <SearchIcon className="size-4 shrink-0" />
      {!isExtraSmall && (
        <>
          <p className="min-w-0 flex-1 text-left leading-tight">Search</p>
          <KeyboardShortcut classNameChip="rounded-full px-2">{shortcut}</KeyboardShortcut>
        </>
      )}
    </Button>
  );
}
