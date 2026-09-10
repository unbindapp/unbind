import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import KeyboardShortcut from "@/components/keyboard-shortcut";
import { TNavbarCommandPanelContext } from "@/components/navigation/navbar";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { detectPlatform, formatForDisplay } from "@tanstack/react-hotkeys";
import { SearchIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  context: TNavbarCommandPanelContext;
  className?: string;
};

export default function NavbarSearchButton({ context, className }: TProps) {
  const { isExtraSmall } = useDeviceSize();
  const shortcut = useMemo(
    () =>
      formatForDisplay("Mod+K", {
        separatorToken: detectPlatform() === "mac" ? "" : undefined,
      }),
    [],
  );

  return (
    <ContextCommandPanel
      title="Search"
      description="Search and run commands"
      triggerType="button"
      context={context}
    >
      <Button
        type="button"
        aria-label="Search"
        variant="outline"
        data-extra-small={isExtraSmall || undefined}
        size="sm"
        className={cn(
          "text-muted-foreground bg-input w-38 justify-start gap-1.5 rounded-full py-1 pr-1 pl-2 font-medium data-extra-small:size-7.5 data-extra-small:justify-center data-extra-small:px-0 sm:rounded-lg",
          className,
        )}
      >
        <SearchIcon className="size-4 shrink-0" />
        {!isExtraSmall && (
          <>
            <p className="min-w-0 flex-1 text-left leading-tight">Search</p>
            <KeyboardShortcut classNameChip="rounded-sm px-1.5 text-muted-foreground">
              {shortcut}
            </KeyboardShortcut>
          </>
        )}
      </Button>
    </ContextCommandPanel>
  );
}
