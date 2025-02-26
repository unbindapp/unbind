"use client";

import { signOutAction } from "@/components/auth/actions";
import Blockies from "@/components/blockies/blockies";
import {
  DropdownOrBottomDrawer,
  DropdownOrBottomDrawerContentDrawer,
  DropdownOrBottomDrawerContentDropdown,
  DropdownOrBottomDrawerTrigger,
} from "@/components/navigation/dropdown-or-bottom-drawer";
import ThemeButton from "@/components/theme-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import { LoaderIcon, LogOutIcon } from "lucide-react";
import { useActionState, useRef, useState } from "react";

type Props = { email: string; className?: string };

export default function UserAvatar({ email, className }: Props) {
  const [, actionSignOut, isPendingSignOut] = useActionState(
    () => signOutAction({ callbackUrl: "/" }),
    null
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <DropdownOrBottomDrawer
      title="User Menu"
      open={open}
      onOpenChange={setOpen}
      classNameDropdown="w-48"
      sideOffset={8}
    >
      <DropdownOrBottomDrawerTrigger
        className={cn(
          "size-7 rounded-full border border-foreground shrink-0 group/button data-[pending]:border-border",
          className
        )}
      >
        <Button
          data-open={open ? true : undefined}
          data-pending={isPendingSignOut ? true : undefined}
          size="icon"
          variant="ghost"
          fadeOnDisabled={false}
        >
          <Blockies
            address={email}
            className="size-full shrink-0 rounded-full transition group-hover/button:rotate-45 group-active/button:rotate-45 group-data-[open]/button:rotate-360"
          />
          {isPendingSignOut && (
            <div className="absolute rounded-full size-full left-0 top-0 bg-background p-1">
              <LoaderIcon className="size-full text-muted-foreground animate-spin" />
            </div>
          )}
        </Button>
      </DropdownOrBottomDrawerTrigger>
      <DropdownOrBottomDrawerContentDrawer>
        <div className="w-full flex flex-col px-2 pt-2 pb-8 group/list">
          <ThemeButton variant="drawer-item" />
          <form
            action={actionSignOut}
            onSubmit={() => setOpen(false)}
            className="w-full flex items-center justify-start"
          >
            <Button
              type="submit"
              className="w-full text-left font-medium justify-start items-center rounded-lg gap-2.5 px-3 py-3.5 cursor-default"
              variant="ghost"
            >
              <div className="size-5 shrink-0 -ml-0.5 -my-1">
                {isPendingSignOut ? (
                  <LoaderIcon className="size-full animate-spin" />
                ) : (
                  <LogOutIcon className="size-full" />
                )}
              </div>
              <p className="shrink min-w-0 leading-tight">Sign Out</p>
            </Button>
          </form>
        </div>
      </DropdownOrBottomDrawerContentDrawer>
      <DropdownOrBottomDrawerContentDropdown>
        <DropdownMenuGroup>
          <ThemeButton variant="dropdown-menu-item" />
          <DropdownMenuItem
            className="p-0"
            onSelect={() => formRef.current?.requestSubmit()}
          >
            <form
              ref={formRef}
              action={actionSignOut}
              className="w-full flex items-center justify-start"
            >
              <button
                className="w-full flex items-center px-2.5 gap-2.5 text-left leading-tight py-2.25 cursor-default"
                type="submit"
              >
                <LogOutIcon className="size-5 shrink-0 -ml-0.5 -my-1" />
                <p className="shrink min-w-0 leading-tight">Sign Out</p>
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownOrBottomDrawerContentDropdown>
    </DropdownOrBottomDrawer>
  );
}
