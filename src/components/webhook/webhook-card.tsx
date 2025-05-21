"use client";

import BrandIcon from "@/components/icons/brand";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
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
import { getWebhookIcon } from "@/components/webhook/helpers";
import { TWebhookProjectProps, TWebhookProps, TWebhookTeamProps } from "@/components/webhook/types";
import { useWebhooksUtils } from "@/components/webhook/webhooks-provider";
import { TWebhookShallow } from "@/server/trpc/api/webhooks/types";
import { api } from "@/server/trpc/setup/client";
import { format } from "date-fns";
import { EllipsisVerticalIcon, TrashIcon } from "lucide-react";
import { ReactNode, useState } from "react";

const placeholderArray = Array.from({ length: 5 }, (_, i) => i);

type TProps =
  | ({
      webhook: TWebhookShallow;
    } & TWebhookTeamProps)
  | ({
      webhook: TWebhookShallow;
    } & TWebhookProjectProps)
  | { type: "placeholder"; webhook?: never; teamId?: never; projectId?: never };

export default function WebhookCard({ type, webhook, teamId, projectId }: TProps) {
  const threeDotTButtonProps =
    type === "project"
      ? { type, teamId, projectId, webhook }
      : type === "team"
        ? { type, teamId, webhook }
        : null;

  return (
    <div
      data-placeholder={type === "placeholder" ? true : undefined}
      className="group/item relative flex flex-col items-start justify-start gap-3 rounded-xl border p-3 sm:p-4 sm:pt-3.5"
    >
      {webhook && <NewEntityIndicator id={webhook.id} />}
      <div className="flex w-full items-start justify-start gap-2 px-0.5 pr-10">
        <BrandIcon
          color="brand"
          brand={type === "placeholder" ? "webhook" : getWebhookIcon(webhook.url)}
          className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground -mt-0.25 size-5 group-data-placeholder/item:rounded-full"
        />
        <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 shrink text-sm leading-tight group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
          {type === "placeholder" ? "https://unbind.app/webhook" : webhook.url}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-start justify-start gap-1.5 text-xs">
        {(type === "placeholder" ? placeholderArray : webhook.events).map((event, i) => (
          <p
            key={type === "placeholder" ? i : event}
            className="bg-border text-muted-foreground group-data-placeholder/item:bg-muted-more-foreground group-data-placeholder/item:animate-skeleton max-w-full rounded-sm px-1.5 py-0.75 leading-tight group-data-placeholder/item:text-transparent"
          >
            {type === "placeholder" ? "loading.loading" : event}
          </p>
        ))}
      </div>
      <p className="text-muted-foreground group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground max-w-full min-w-0 shrink px-0.75 text-sm leading-tight group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
        {type === "placeholder" ? "Jan 01, 2024" : format(webhook.created_at, "MMMM dd, yyyy")}
      </p>
      {!threeDotTButtonProps ? (
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
        <ThreeDotButton {...threeDotTButtonProps} className="absolute top-1 right-1" />
      )}
    </div>
  );
}

function ThreeDotButton({
  webhook,
  type,
  teamId,
  projectId,
  className,
}: {
  webhook: TWebhookShallow;
  className?: string;
} & TWebhookProps) {
  const [isOpen, setIsOpen] = useState(false);

  const deleteTriggerProps = type === "project" ? { type, teamId, projectId } : { type, teamId };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isOpen ? true : undefined}
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-more-foreground group/button rounded-lg group-data-placeholder/card:text-transparent",
            className,
          )}
        >
          <EllipsisVerticalIcon className="size-6 transition-transform group-data-open/button:rotate-90" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="z-50 w-40"
        sideOffset={-1}
        data-open={isOpen ? true : undefined}
        align="end"
        forceMount={true}
      >
        <ScrollArea>
          <DropdownMenuGroup>
            <DeleteTrigger
              {...deleteTriggerProps}
              webhook={webhook}
              closeDropdown={() => setIsOpen(false)}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <TrashIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeleteTrigger({
  webhook,
  type,
  teamId,
  projectId,
  closeDropdown,
  children,
}: {
  webhook: TWebhookShallow;
  closeDropdown: () => void;
  children: ReactNode;
} & TWebhookProps) {
  const { invalidate: invalidateWebhooks } = useWebhooksUtils(
    type === "project"
      ? { type, teamId, projectId }
      : {
          type,
          teamId,
          projectId,
        },
  );

  const {
    mutateAsync: deleteWebhook,
    error: deleteWebhookError,
    reset: deleteWebhookReset,
  } = api.webhooks.delete.useMutation({
    onSuccess: async () => {
      await invalidateWebhooks();
      closeDropdown();
    },
  });

  if (true) {
    return (
      <DeleteEntityTrigger
        dialogTitle="Delete Webhook"
        dialogDescription="Are you sure you want to delete this webhook? This action cannot be undone."
        disableConfirmationInput
        EntityNameBadge={() => (
          <p className="bg-foreground/6 border-foreground/6 -ml-0.5 max-w-[calc(100%+0.25rem)] truncate rounded-md border px-1.5 py-0.25 text-sm font-medium">
            {webhook.url}
          </p>
        )}
        deletingEntityName={webhook.url}
        onDialogClose={() => {
          deleteWebhookReset();
        }}
        onDialogCloseImmediate={() => {
          closeDropdown();
        }}
        error={deleteWebhookError}
        onSubmit={async () => {
          await deleteWebhook(
            type === "project"
              ? { id: webhook.id, type, teamId, projectId }
              : { id: webhook.id, type, teamId },
          );
        }}
      >
        {children}
      </DeleteEntityTrigger>
    );
  }
}
