"use client";

import { signOutAction } from "@/components/auth/actions";
import Blockies from "@/components/blockies/blockies";
import {
  DropdownOrDrawer,
  DropdownOrDrawerContentForDrawer,
  DropdownOrDrawerContentForDropdown,
  DropdownOrDrawerTrigger,
} from "@/components/navigation/dropdown-or-drawer";
import ThemeButton from "@/components/theme-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import { useCheckForUpdates } from "@/components/update/check-for-updates-provider";
import { GitBranchIcon, LoaderIcon, LogOutIcon } from "lucide-react";
import { useActionState, useRef, useState } from "react";

type TProps = { email: string; className?: string };

export default function UserAvatar({ email, className }: TProps) {
  const [, actionSignOut, isPendingSignOut] = useActionState(() => signOutAction(), null);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const {
    data: updatesData,
    isPending: isPendingUpdatesResult,
    isError: isErrorUpdatesResult,
  } = useCheckForUpdates();

  return (
    <DropdownOrDrawer
      title={email}
      titleSize="sm"
      TitleIcon={({ className }: { className: string }) => (
        <Blockies
          address={email}
          className={cn("border-foreground rounded-full border", className)}
        />
      )}
      open={open}
      onOpenChange={setOpen}
      classNameDropdown="w-64"
      sideOffset={8}
    >
      <DropdownOrDrawerTrigger>
        <Button
          data-open={open ? true : undefined}
          data-pending={isPendingSignOut ? true : undefined}
          size="icon"
          variant="ghost"
          fadeOnDisabled={false}
          className={cn(
            "border-foreground group/button data-pending:border-border size-6.5 shrink-0 rounded-full border",
            className,
          )}
        >
          <Blockies
            address={email}
            className="size-full shrink-0 rounded-full transition group-active/button:rotate-45 group-data-open/button:rotate-360 has-hover:group-hover/button:rotate-45"
          />
          {isPendingSignOut && (
            <div className="bg-background absolute top-0 left-0 size-full rounded-full p-1">
              <LoaderIcon className="text-muted-foreground size-full animate-spin" />
            </div>
          )}
        </Button>
      </DropdownOrDrawerTrigger>
      <DropdownOrDrawerContentForDrawer>
        <div className="group/list flex w-full flex-col px-2 pt-2 pb-[calc(var(--safe-area-inset-bottom)+4rem)]">
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <ThemeButton variant="drawer-item" />
          <form
            action={actionSignOut}
            onSubmit={() => setOpen(false)}
            className="flex w-full items-center justify-start"
          >
            <Button
              disabled={isPendingSignOut}
              type="submit"
              className="w-full cursor-default items-center justify-start gap-2.5 rounded-lg px-3 py-3.5 text-left font-medium"
              variant="ghost"
            >
              <div className="-my-1 -ml-0.5 size-5 shrink-0">
                {isPendingSignOut ? (
                  <LoaderIcon className="size-full animate-spin" />
                ) : (
                  <LogOutIcon className="size-full" />
                )}
              </div>
              <p className="min-w-0 shrink leading-tight">Sign Out</p>
            </Button>
          </form>
        </div>
        <div
          data-pending={isPendingUpdatesResult ? true : undefined}
          data-error={
            !updatesData && !isPendingUpdatesResult && isErrorUpdatesResult ? true : undefined
          }
          className="group/version bg-background absolute bottom-[var(--safe-area-inset-bottom)] z-10 flex w-full items-center justify-center gap-1.25 border-t px-5 py-2.75"
        >
          {!isPendingUpdatesResult && (
            <GitBranchIcon className="text-muted-foreground -ml-0.25 size-3.75 shrink-0" />
          )}
          <p className="group-data-pending/version:bg-muted-foreground group-data-pending/version:animate-skeleton text-muted-foreground min-w-0 shrink text-center text-sm leading-tight group-data-pending/version:rounded-sm group-data-pending/version:text-transparent">
            Version:{" "}
            <span className="group-data-error/version:text-destructive font-semibold">
              {updatesData
                ? updatesData.data.current_version
                : isPendingUpdatesResult
                  ? "1234567"
                  : "Error"}
            </span>
          </p>
        </div>
      </DropdownOrDrawerContentForDrawer>
      <DropdownOrDrawerContentForDropdown>
        <div className="flex w-full items-center justify-start gap-2.5 px-3 py-3">
          <div className="border-foreground size-5 shrink-0 rounded-full border">
            <Blockies address={email} className="size-full rounded-full" />
          </div>
          <p className="min-w-0 shrink overflow-hidden leading-tight font-medium text-ellipsis whitespace-nowrap">
            {email}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <ThemeButton variant="dropdown-menu-item" />
          <DropdownMenuItem
            disabled={isPendingSignOut}
            className="p-0"
            onSelect={() => {
              if (isPendingSignOut) return;
              formRef.current?.requestSubmit();
            }}
          >
            <form
              ref={formRef}
              action={actionSignOut}
              className="flex w-full items-center justify-start"
            >
              <button
                className="flex w-full cursor-default items-center gap-2.5 px-3 py-2.25 text-left leading-tight"
                type="submit"
              >
                <LogOutIcon className="-my-1 -ml-0.5 size-5 shrink-0" />
                <p className="min-w-0 shrink leading-tight">Sign Out</p>
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div
          data-pending={isPendingUpdatesResult ? true : undefined}
          data-error={
            !updatesData && !isPendingUpdatesResult && isErrorUpdatesResult ? true : undefined
          }
          className="group/version flex w-full items-center justify-center gap-1.25 px-4 py-2"
        >
          {!isPendingUpdatesResult && (
            <GitBranchIcon className="text-muted-foreground -ml-0.25 size-3.75 shrink-0" />
          )}
          <p className="group-data-pending/version:bg-muted-foreground group-data-pending/version:animate-skeleton text-muted-foreground min-w-0 shrink text-center text-sm leading-tight group-data-pending/version:rounded-sm group-data-pending/version:text-transparent">
            Version:{" "}
            <span className="group-data-error/version:text-destructive font-semibold">
              {updatesData
                ? updatesData.data.current_version
                : isPendingUpdatesResult
                  ? "1234567"
                  : "Error"}
            </span>
          </p>
        </div>
      </DropdownOrDrawerContentForDropdown>
    </DropdownOrDrawer>
  );
}
