"use client";

import { signOutAction } from "@/components/auth/actions";
import Blockies from "@/components/blockies/blockies";
import ThemeButton from "@/components/theme-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { LoaderIcon, LogOutIcon } from "lucide-react";
import { useActionState, useState } from "react";

type Props = { email: string; className?: string };

export default function UserAvatar({ email, className }: Props) {
  const [, actionSignOut, isPendingSignOut] = useActionState(
    () => signOutAction({ callbackUrl: "/" }),
    null
  );
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger disabled={isPendingSignOut} asChild>
        <Button
          data-open={open ? true : undefined}
          data-pending={isPendingSignOut ? true : undefined}
          size="icon"
          className={cn(
            "size-7 rounded-full border border-foreground shrink-0 group/button data-[pending]:border-border",
            className
          )}
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
      </DropdownMenuTrigger>
      <DropdownMenuContent
        sideOffset={8}
        align="end"
        className="w-[768px] sm:w-56"
      >
        <ScrollArea>
          <DropdownMenuGroup>
            <ThemeButton variant="dropdown-menu-item" />
            <DropdownMenuItem className="p-0">
              <form
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
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
