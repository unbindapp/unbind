"use client";

import { AccessChips, Chip } from "@/components/api-key/access-chips";
import { useConnectedAppsUtils } from "@/components/connected-apps/connected-apps-provider";
import BrandIcon from "@/components/icons/brand";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import { createDialogHandle, DialogTrigger, TDialogHandle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import {
  revokeConnectedApp as revokeConnectedAppFn,
  type TConnectedApp,
} from "@/lib/queries/connected-apps";
import { useMutation } from "@tanstack/react-query";
import {
  BoxIcon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  GlobeIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

type TProps =
  | { connectedApp: TConnectedApp; isPlaceholder?: never }
  | { connectedApp?: never; isPlaceholder: true };

export default function ConnectedAppCard({ isPlaceholder, connectedApp }: TProps) {
  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className="group/item relative flex flex-col items-start justify-start gap-3 rounded-xl border p-3 sm:p-4 sm:pt-3.5"
    >
      <div className="flex w-full items-start justify-start gap-1.5 px-0.5 pr-10 leading-tight">
        <div className="line-icon">
          <BrandIcon
            brand={connectedApp?.verified_brand}
            Fallback={BoxIcon}
            color="brand"
            className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground size-4.5 group-data-placeholder/item:rounded-full"
          />
        </div>
        <div className="flex min-w-0 shrink flex-wrap items-center gap-x-2 gap-y-1">
          <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 shrink font-medium group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
            {connectedApp ? connectedApp.client_name : "Loading app"}
          </p>
          <Chip>
            <GlobeIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
            {connectedApp ? publisher(connectedApp) : "example.com"}
          </Chip>
          {connectedApp?.verified_brand ? (
            <Chip className="text-success bg-success/4-10 border-success/4-10 font-medium">
              <ShieldCheckIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
              Verified
            </Chip>
          ) : (
            <Chip className="text-warning bg-warning/4-10 border-warning/4-10 font-medium">
              <CircleAlertIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
              Unverified
            </Chip>
          )}
        </div>
      </div>
      <AccessChips access={connectedApp} />
      <p className="text-muted-foreground group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground max-w-full min-w-0 shrink px-0.75 text-sm leading-tight group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
        <Timeline {...(isPlaceholder ? { isPlaceholder: true } : { connectedApp })} />
      </p>
      {!connectedApp ? (
        <Button
          disabled
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 rounded-lg"
        >
          <div className="bg-muted-more-foreground animate-skeleton size-6 rounded-md" />
        </Button>
      ) : (
        <ThreeDotButton connectedApp={connectedApp} className="absolute top-1 right-1" />
      )}
    </div>
  );
}

function publisher(connectedApp: TConnectedApp) {
  if (connectedApp.kind === "metadata_document") return connectedApp.client_host;
  return "Self-registered";
}

const placeholderTime = new Date("2020-01-01T00:00:00Z");

function Timeline({
  connectedApp,
  isPlaceholder,
}:
  | { connectedApp: TConnectedApp; isPlaceholder?: never }
  | { connectedApp?: never; isPlaceholder: true }) {
  const { str: lastUsed } = useTimeDifference({
    timestamp: isPlaceholder
      ? placeholderTime.getTime()
      : connectedApp.last_used_at
        ? new Date(connectedApp.last_used_at).getTime()
        : undefined,
  });
  return (
    <>
      <span>
        {isPlaceholder
          ? "Never used"
          : connectedApp.last_used_at && lastUsed
            ? `Last used ${lastUsed}`
            : "Never used"}
      </span>
      {!isPlaceholder && (
        <span className="text-muted-more-foreground hidden px-[0.75ch] sm:inline">|</span>
      )}
      <span className="mt-1 block sm:mt-0 sm:inline">
        Connected at{" "}
        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(connectedApp?.created_at || placeholderTime),
        )}
      </span>
    </>
  );
}

function ThreeDotButton({
  connectedApp,
  className,
}: {
  connectedApp: TConnectedApp;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [deleteHandle] = useState(() => createDialogHandle());

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="App options"
              data-open={isOpen || undefined}
              fadeOnDisabled={false}
              variant="ghost"
              size="icon"
              className={cn("text-muted-more-foreground group/button rounded-lg", className)}
            >
              <EllipsisVerticalIcon className="size-6 transition-transform group-data-open/button:rotate-90" />
            </Button>
          }
        />
        <DropdownMenuContent
          className="z-50 w-40"
          sideOffset={-1}
          data-open={isOpen || undefined}
          align="end"
          keepMounted
        >
          <ScrollArea>
            <DropdownMenuGroup>
              {/* The dialog lives outside the menu; nested inside the open modal menu it would be inert */}
              <DialogTrigger
                nativeButton={false}
                handle={deleteHandle}
                render={
                  <DropdownMenuItem className="text-destructive active:bg-destructive/4-10 data-highlighted:bg-destructive/4-10 data-highlighted:text-destructive">
                    <Trash2Icon className="-ml-0.5 size-5" />
                    <p className="min-w-0 shrink leading-tight">Revoke</p>
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      <RevokeTrigger connectedApp={connectedApp} handle={deleteHandle} />
    </>
  );
}

function RevokeTrigger({
  connectedApp,
  handle,
}: {
  connectedApp: TConnectedApp;
  handle?: TDialogHandle;
}) {
  const { invalidate } = useConnectedAppsUtils();
  const {
    mutateAsync: revokeConnectedApp,
    error: revokeError,
    reset: revokeReset,
  } = useMutation({
    mutationFn: revokeConnectedAppFn,
    onSuccess: async () => {
      await invalidate();
    },
  });

  return (
    <DeleteEntityTrigger
      dialogTitle="Revoke Access"
      dialogDescription="The application loses access immediately and has to be authorized again."
      disableConfirmationInput
      submitButtonText="Revoke"
      EntityNameBadge={() => (
        <p className="bg-foreground/2-10 border-foreground/2-10 -ml-0.5 max-w-[calc(100%+0.25rem)] truncate rounded-md border px-1.5 py-px text-sm font-medium">
          {connectedApp.client_name}
        </p>
      )}
      deletingEntityName={connectedApp.client_name}
      handle={handle}
      onDialogClose={() => {
        revokeReset();
      }}
      error={revokeError}
      onSubmit={async () => {
        await revokeConnectedApp({ id: connectedApp.id });
      }}
    />
  );
}
