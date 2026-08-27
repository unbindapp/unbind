"use client";

import Blockies from "@/components/blockies/blockies";
import {
  DropdownOrDrawer,
  DropdownOrDrawerContentForDrawer,
  DropdownOrDrawerContentForDropdown,
  DropdownOrDrawerTrigger,
} from "@/components/navigation/dropdown-or-drawer";
import ThemeButton from "@/components/theme-button";
import { Button, LinkButton } from "@/components/ui/button";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import {
  useCheckForUpdates,
  useCheckNewVersion,
} from "@/components/update/check-for-updates-provider";
import { meQuery } from "@/lib/queries/me";
import { getGoClient } from "@/lib/server/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRouter } from "@tanstack/react-router";
import { ExternalLink, GiftIcon, GitBranchIcon, LoaderIcon, LogOutIcon } from "lucide-react";
import { useState } from "react";

type TProps = { email: string; className?: string };

export default function UserAvatar({ email, className }: TProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { mutate: signOut, isPending: isPendingSignOut } = useMutation({
    mutationFn: async () => await getGoClient().auth.logout(),
    onSuccess: () => {
      queryClient.setQueryData(meQuery.queryKey, null);
      router.history.push("/sign-in");
    },
  });
  const [open, setOpen] = useState(false);

  const {
    data: updatesData,
    isPending: isPendingUpdatesResult,
    isError: isErrorUpdatesResult,
  } = useCheckForUpdates();

  const { hasUpdateAvailable, hasUnseenUpdate, latestVersion } = useCheckNewVersion();
  const locationHref = useLocation({ select: (l) => l.href });

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
          data-open={open || undefined}
          data-pending={isPendingSignOut || undefined}
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
          {hasUnseenUpdate && (
            <div className="bg-background pointer-events-none absolute -top-0.5 -right-0.5 rounded-full p-0.5">
              <div className="bg-destructive size-1.5 rounded-full" />
            </div>
          )}
          {isPendingSignOut && (
            <div className="bg-background absolute top-0 left-0 size-full rounded-full p-1">
              <LoaderIcon className="text-muted-foreground size-full animate-spin" />
            </div>
          )}
        </Button>
      </DropdownOrDrawerTrigger>
      <DropdownOrDrawerContentForDrawer>
        <div className="group/list flex w-full flex-col px-2 pt-2 pb-[calc(var(--safe-area-inset-bottom)+4rem)]">
          {hasUpdateAvailable && (
            <NewVersionCard
              className="pt-0 pb-1.5"
              version={latestVersion}
              fromHref={locationHref}
              onUpdateClicked={() => setOpen(false)}
            />
          )}
          <ThemeButton variant="drawer-item" />
          <Button
            disabled={isPendingSignOut}
            onClick={() => {
              setOpen(false);
              signOut();
            }}
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
        </div>
        <div
          data-pending={isPendingUpdatesResult || undefined}
          data-error={
            (!updatesData && !isPendingUpdatesResult && isErrorUpdatesResult) || undefined
          }
          className="group/version bg-background absolute bottom-(--safe-area-inset-bottom) z-10 flex w-full border-t"
        >
          {updatesData ? (
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={updatesData.data.current_version_url}
              className="group/version hover:bg-border active:bg-border flex w-full items-center justify-start gap-1.25 px-4.25 py-3"
            >
              <GitBranchOrExternalLinkIcon />
              <p className="text-muted-foreground group-hover/version:text-foreground group-active/version:text-foreground min-w-0 shrink text-center text-sm leading-tight">
                Version: <span className="font-semibold">{updatesData.data.current_version}</span>
              </p>
            </a>
          ) : (
            <div className="flex w-full items-center justify-start gap-1.25 px-4.25 py-3">
              {!isPendingUpdatesResult && (
                <GitBranchIcon className="text-muted-foreground -ml-px size-3.75 shrink-0" />
              )}
              <p className="group-data-pending/version:bg-muted-foreground group-data-pending/version:animate-skeleton text-muted-foreground min-w-0 shrink text-center text-sm leading-tight group-data-pending/version:rounded-sm group-data-pending/version:text-transparent">
                Version:{" "}
                <span className="group-data-error/version:text-destructive font-semibold">
                  {isPendingUpdatesResult ? "1234567" : "Error"}
                </span>
              </p>
            </div>
          )}
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
          {hasUpdateAvailable && (
            <NewVersionCard
              className="px-0.5 pt-0.5 pb-1.5"
              version={latestVersion}
              fromHref={locationHref}
              onUpdateClicked={() => setOpen(false)}
            />
          )}
          <ThemeButton variant="dropdown-menu-item" />
          <DropdownMenuItem
            disabled={isPendingSignOut}
            className="p-0"
            onSelect={() => {
              if (isPendingSignOut) return;
              signOut();
            }}
          >
            <button
              className="flex w-full cursor-default items-center gap-2.5 px-3 py-2.25 text-left leading-tight"
              type="button"
            >
              <LogOutIcon className="-my-1 -ml-0.5 size-5 shrink-0" />
              <p className="min-w-0 shrink leading-tight">Sign Out</p>
            </button>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {updatesData ? (
            <DropdownMenuItem
              asChild
              className="group/version flex w-full cursor-pointer items-center gap-1.5 px-3 py-2 text-left leading-tight"
            >
              <a
                target="_blank"
                rel="noopener noreferrer"
                href={updatesData.data.current_version_url}
              >
                <GitBranchOrExternalLinkIcon />
                <p className="group-hover/version:text-foreground group-active/version:text-foreground text-muted-foreground min-w-0 shrink text-center text-sm leading-tight">
                  Version: <span className="font-semibold">{updatesData.data.current_version}</span>
                </p>
              </a>
            </DropdownMenuItem>
          ) : (
            <div
              data-pending={isPendingUpdatesResult || undefined}
              data-error={(!isPendingUpdatesResult && isErrorUpdatesResult) || undefined}
              className="group/version flex w-full items-center gap-1.5 px-3 py-2 text-left leading-tight"
            >
              {!isPendingUpdatesResult && (
                <GitBranchIcon className="text-muted-foreground -ml-px size-3.75 shrink-0" />
              )}
              <p className="group-data-pending/version:bg-muted-foreground group-data-pending/version:animate-skeleton text-muted-foreground min-w-0 shrink text-center text-sm leading-tight group-data-pending/version:rounded-sm group-data-pending/version:text-transparent">
                Version:{" "}
                <span className="group-data-error/version:text-destructive font-semibold">
                  {isPendingUpdatesResult ? "1234567" : "Error"}
                </span>
              </p>
            </div>
          )}
        </DropdownMenuGroup>
      </DropdownOrDrawerContentForDropdown>
    </DropdownOrDrawer>
  );
}

function GitBranchOrExternalLinkIcon({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "text-muted-foreground has-hover:group-hover/version:text-foreground group-active/version:text-foreground relative -ml-px size-3.75 shrink-0 transition-[rotate,opacity] group-active/version:rotate-45 has-hover:group-hover/version:rotate-45",
        className,
      )}
    >
      <GitBranchIcon className="size-full group-active/version:opacity-0 has-hover:group-hover/version:opacity-0" />
      <ExternalLink className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active/version:opacity-100 has-hover:group-hover/version:opacity-100" />
    </div>
  );
}

function NewVersionCard({
  version,
  fromHref,
  onUpdateClicked,
  className,
  classNameInner,
}: {
  version: string;
  fromHref: string;
  onUpdateClicked: () => void;
  className?: string;
  classNameInner?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "border-success/8 bg-success/8 flex w-full flex-col gap-3 rounded-lg border px-2 py-2",
          classNameInner,
        )}
      >
        <div className="flex w-full flex-col gap-1">
          <div className="flex w-full items-start gap-1.5 px-1">
            <GiftIcon className="text-success -ml-0.5 size-4.5 shrink-0" />
            <p className="text-success min-w-0 shrink leading-tight font-semibold">
              Update available!
            </p>
          </div>
          <div className="flex w-full items-center justify-start gap-1.5 px-1 text-sm">
            <GitBranchIcon className="text-muted-foreground -ml-0.5 size-4.5 shrink-0" />
            <p className="text-muted-foreground">
              Version: <span className="text-foreground font-semibold">{version}</span>
            </p>
          </div>
        </div>
        <LinkButton
          onClick={onUpdateClicked}
          to="/update"
          search={{ from: fromHref }}
          size="sm"
          className="rounded-sm"
          variant="success"
        >
          Update
        </LinkButton>
      </div>
    </div>
  );
}
