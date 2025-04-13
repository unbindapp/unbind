"use client";

import ErrorCard from "@/components/error-card";
import BrandIcon from "@/components/icons/brand";
import { cn } from "@/components/ui/utils";
import { getWebhookIcon } from "@/components/webhook/helpers";
import { useWebhooks } from "@/components/webhook/webhooks-provider";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { ReactNode } from "react";

type TProps = {
  className?: string;
};

const webhooksPlaceholderArray = Array.from({ length: 4 }, (_, i) => i);
const webhookEventsPlaceholderArray = Array.from({ length: 5 }, (_, i) => i);

export default function WebhooksList({ className }: TProps) {
  const { data, isPending, error } = useWebhooks();

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
        <WebhookCard key={webhook.id} webhook={webhook} />
      ))}
    </Wrapper>
  );
}

function WebhookCard({
  webhook,
  isPlaceholder,
}:
  | { webhook: AppRouterOutputs["webhooks"]["list"]["webhooks"][number]; isPlaceholder?: never }
  | { webhook?: never; isPlaceholder: true }) {
  return (
    <div
      data-placeholder={isPlaceholder ? true : undefined}
      className="group/item flex flex-col gap-2.5 rounded-lg border p-3"
    >
      <div className="flex w-full gap-2 px-0.5">
        <BrandIcon
          className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground size-5 group-data-placeholder/item:rounded-md"
          brand={isPlaceholder ? "webhook" : getWebhookIcon(webhook.url)}
        />
        <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 shrink leading-tight group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {isPlaceholder ? "https://unbind.app/webhook" : webhook.url}
        </p>
      </div>
      <div className="flex w-full flex-wrap gap-1.5 text-xs">
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
    </div>
  );
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full flex-col gap-2", className)}>{children}</div>;
}
