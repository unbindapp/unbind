"use client";

import { useApiKeysUtils } from "@/components/api-key/api-keys-provider";
import { AccessChips, Chip } from "@/components/api-key/access-chips";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
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
import { deleteApiKey as deleteApiKeyFn, type TApiKeyShallow } from "@/lib/queries/api-keys";
import { useMutation } from "@tanstack/react-query";
import { differenceInDays, formatDistanceToNowStrict, isPast } from "date-fns";
import {
  CircleAlertIcon,
  EllipsisVerticalIcon,
  KeySquareIcon,
  TriangleAlertIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

type TProps =
  { apiKey: TApiKeyShallow; isPlaceholder?: never } | { apiKey?: never; isPlaceholder: true };

export default function ApiKeyCard({ isPlaceholder, apiKey }: TProps) {
  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className="group/item relative flex flex-col items-start justify-start gap-3 rounded-xl border p-3 sm:p-4 sm:pt-3.5"
    >
      {apiKey && <NewEntityIndicator id={apiKey.id} />}
      <div className="flex w-full items-start justify-start gap-1.5 px-0.5 pr-10 leading-tight">
        <div className="line-icon">
          <KeySquareIcon className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground size-4.5 group-data-placeholder/item:rounded-full" />
        </div>
        <div className="flex min-w-0 shrink flex-wrap items-center gap-x-2 gap-y-1">
          <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 shrink font-medium group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
            {apiKey ? apiKey.name : "Loading key"}
          </p>
          <Chip className="font-mono">{apiKey ? `${apiKey.token_prefix}...` : "unb_1234..."}</Chip>
        </div>
      </div>
      <AccessChips access={apiKey} />
      <p className="text-muted-foreground group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground max-w-full min-w-0 shrink px-0.75 text-sm leading-tight group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
        <Timeline {...(isPlaceholder ? { isPlaceholder: true } : { apiKey })} />
      </p>
      {!apiKey ? (
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
        <ThreeDotButton apiKey={apiKey} className="absolute top-1 right-1" />
      )}
    </div>
  );
}

const placeholderTime = new Date("2020-01-01T00:00:00Z");

function Timeline({
  apiKey,
  isPlaceholder,
}: { apiKey: TApiKeyShallow; isPlaceholder?: never } | { apiKey?: never; isPlaceholder: true }) {
  const { str: lastUsed } = useTimeDifference({
    timestamp: isPlaceholder
      ? placeholderTime.getTime()
      : apiKey.last_used_at
        ? new Date(apiKey.last_used_at).getTime()
        : undefined,
  });
  const expiry: ReturnType<typeof describeExpiry> = isPlaceholder
    ? { state: "never", text: "Never expires" }
    : describeExpiry(isPlaceholder ? placeholderTime.toISOString() : apiKey.expires_at);
  return (
    <>
      <span
        data-state={expiry.state}
        className="data-[state=soon]:text-warning data-[state=expired]:text-destructive"
      >
        {expiry.state === "soon" && (
          <CircleAlertIcon className="mr-1 mb-0.5 inline-block size-3.5" />
        )}
        {expiry.state === "expired" && (
          <TriangleAlertIcon className="mr-1 mb-0.5 inline-block size-3.5" />
        )}
        {expiry.text}
      </span>
      {!isPlaceholder && <span className="text-muted-more-foreground px-[0.75ch]">|</span>}
      <span>
        {isPlaceholder
          ? "Never used"
          : apiKey.last_used_at && lastUsed
            ? `Last used ${lastUsed}`
            : "Never used"}
      </span>
      {!isPlaceholder && (
        <span className="text-muted-more-foreground hidden px-[0.75ch] sm:inline">|</span>
      )}
      <span className="mt-1 block sm:mt-0 sm:inline">
        Created at{" "}
        {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(apiKey?.created_at || placeholderTime),
        )}
      </span>
    </>
  );
}

function describeExpiry(expiresAt: string | undefined) {
  if (!expiresAt) return { state: "never", text: "Never expires" } as const;
  const date = new Date(expiresAt);
  if (isPast(date)) return { state: "expired", text: "Expired" } as const;
  const distance = formatDistanceToNowStrict(date);
  const state = differenceInDays(date, new Date()) < 7 ? "soon" : "later";
  return { state, text: `Expires in ${distance}` } as const;
}

function ThreeDotButton({ apiKey, className }: { apiKey: TApiKeyShallow; className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [deleteHandle] = useState(() => createDialogHandle());

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Key options"
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
      <RevokeTrigger apiKey={apiKey} handle={deleteHandle} />
    </>
  );
}

function RevokeTrigger({ apiKey, handle }: { apiKey: TApiKeyShallow; handle?: TDialogHandle }) {
  const { invalidate } = useApiKeysUtils();
  const {
    mutateAsync: deleteApiKey,
    error: deleteError,
    reset: deleteReset,
  } = useMutation({
    mutationFn: deleteApiKeyFn,
    onSuccess: async () => {
      await invalidate();
    },
  });

  return (
    <DeleteEntityTrigger
      dialogTitle="Revoke API Key"
      dialogDescription="Anything using this key stops working immediately. This action cannot be undone."
      disableConfirmationInput
      submitButtonText="Revoke"
      EntityNameBadge={() => (
        <p className="bg-foreground/2-10 border-foreground/2-10 -ml-0.5 max-w-[calc(100%+0.25rem)] truncate rounded-md border px-1.5 py-px text-sm font-medium">
          {apiKey.name}
        </p>
      )}
      deletingEntityName={apiKey.name}
      handle={handle}
      onDialogClose={() => {
        deleteReset();
      }}
      error={deleteError}
      onSubmit={async () => {
        await deleteApiKey({ id: apiKey.id });
      }}
    />
  );
}
