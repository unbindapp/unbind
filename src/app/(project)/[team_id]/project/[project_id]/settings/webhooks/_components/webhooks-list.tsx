"use client";

import ErrorCard from "@/components/error-card";
import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useProject } from "@/components/project/project-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useWebhooks, useWebhooksUtils } from "@/components/webhook/webhooks-provider";
import { defaultAnimationMs } from "@/lib/constants";
import { TWebhookShallow } from "@/server/trpc/api/webhooks/types";
import { api } from "@/server/trpc/setup/client";
import { format } from "date-fns";
import { EllipsisVerticalIcon, TrashIcon } from "lucide-react";
import { ReactNode, useRef, useState } from "react";

type TProps = {
  className?: string;
};

const webhooksPlaceholderArray = Array.from({ length: 4 }, (_, i) => i);
const webhookEventsPlaceholderArray = Array.from({ length: 5 }, (_, i) => i);

export default function WebhooksList({ className }: TProps) {
  const { data, isPending, error } = useWebhooks();
  const { teamId, projectId } = useProject();

  if (!data && !isPending && error) {
    return (
      <Wrapper className={className}>
        <ErrorCard message={error.message} />
      </Wrapper>
    );
  }

  if (!data && isPending) {
    return (
      <Wrapper className={className}>
        {webhooksPlaceholderArray.map((_, i) => (
          <WebhookCard key={i} isPlaceholder />
        ))}
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className}>
      {data.webhooks.map((webhook) => (
        <WebhookCard key={webhook.id} webhook={webhook} teamId={teamId} projectId={projectId} />
      ))}
    </Wrapper>
  );
}

function WebhookCard({
  webhook,
  teamId,
  projectId,
  isPlaceholder,
}:
  | { webhook: TWebhookShallow; teamId: string; projectId: string; isPlaceholder?: never }
  | { webhook?: never; teamId?: never; projectId?: never; isPlaceholder: true }) {
  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      className="group/item relative flex flex-col items-start justify-start gap-2.5 rounded-lg border p-3"
    >
      <div className="flex w-full gap-2 px-0.5 pr-8">
        <BrandIcon
          className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground size-5 group-data-placeholder/item:rounded-md"
          brand={isPlaceholder ? "webhook" : getWebhookIcon(webhook.url)}
        />
        <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 shrink leading-tight group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {isPlaceholder ? "https://unbind.app/webhook" : webhook.url}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-start justify-start gap-1.5 text-xs">
        {isPlaceholder
          ? webhookEventsPlaceholderArray.map((_, i) => (
              <p
                key={i}
                className="bg-muted-more-foreground animate-skeleton rounded-md px-2 py-1 leading-tight text-transparent select-none"
              >
                loading.loading
              </p>
            ))
          : webhook.events.map((event) => (
              <p
                key={event}
                className="bg-border text-muted-foreground rounded-md px-2 py-1 leading-tight"
              >
                {event}
              </p>
            ))}
      </div>
      <p className="text-muted-foreground group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground max-w-full min-w-0 shrink px-0.5 text-sm leading-tight group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
        {isPlaceholder ? "Jan 01, 2024" : format(webhook.created_at, "MMMM dd, yyyy")}
      </p>
      {isPlaceholder ? (
        <div className="absolute top-1 right-1 flex size-9 items-center justify-center">
          <div className="bg-muted-foreground animate-skeleton size-5 rounded-md" />
        </div>
      ) : (
        <ThreeDotButton
          className="absolute top-1 right-1"
          teamId={teamId}
          projectId={projectId}
          webhook={webhook}
        />
      )}
    </div>
  );
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full flex-col gap-2", className)}>{children}</div>;
}

function ThreeDotButton({
  webhook,
  teamId,
  projectId,
  className,
}: {
  webhook: TWebhookShallow;
  teamId: string;
  projectId: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isOpen ? true : undefined}
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-more-foreground group/button rounded-md group-data-placeholder/card:text-transparent",
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
              teamId={teamId}
              projectId={projectId}
              webhook={webhook}
              closeDropdown={() => setIsOpen(false)}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
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
  teamId,
  projectId,
  closeDropdown,
  children,
}: {
  webhook: TWebhookShallow;
  teamId: string;
  projectId: string;
  closeDropdown: () => void;
  children: ReactNode;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { invalidate: invalidateWebhooks } = useWebhooksUtils({
    type: "project",
    teamId,
    projectId,
  });

  const timeout = useRef<NodeJS.Timeout | null>(null);

  const {
    mutateAsync: deleteWebhook,
    error: deleteWebhookError,
    reset: deleteWebhookReset,
    isPending: deleteWebhookIsPending,
  } = api.webhooks.delete.useMutation({
    onSuccess: async () => {
      await invalidateWebhooks();
      setIsDialogOpen(false);
      closeDropdown();
    },
  });

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(o) => {
        setIsDialogOpen(o);
        if (!o) {
          if (timeout.current) clearTimeout(timeout.current);
          timeout.current = setTimeout(() => {
            deleteWebhookReset();
          }, defaultAnimationMs);
          closeDropdown();
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        <DialogHeader>
          <DialogTitle>Delete Webhook</DialogTitle>
          <p className="bg-border -mx-0.5 w-[calc(100%+0.25rem)] truncate rounded-md px-2 py-1 text-sm leading-tight font-medium">
            {webhook.url}
          </p>
          <DialogDescription>
            Are you sure you want to delete this webhook? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {deleteWebhookError && <ErrorLine message={deleteWebhookError.message} />}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose asChild className="text-muted-foreground">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={() => deleteWebhook({ id: webhook.id, type: "project", teamId, projectId })}
            data-submitting={deleteWebhookIsPending ? true : undefined}
            variant="destructive"
            isPending={deleteWebhookIsPending}
          >
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
