"use client";

import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { cn } from "@/components/ui/utils";
import { TWebhookProps } from "@/components/webhook/types";
import WebhookCard from "@/components/webhook/webhook-card";
import { useWebhooks } from "@/components/webhook/webhooks-provider";
import { WebhookIcon } from "lucide-react";
import { ReactNode } from "react";

type TProps = {
  className?: string;
} & TWebhookProps;

const placeholdeArray = Array.from({ length: 4 }, (_, i) => i);

export default function WebhooksList({ className, ...rest }: TProps) {
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
        {placeholdeArray.map((_, i) => (
          <WebhookCard key={i} type="placeholder" />
        ))}
      </Wrapper>
    );
  }

  if (data && data.webhooks.length === 0) {
    return (
      <Wrapper className={className}>
        <NoItemsCard Icon={WebhookIcon}>No webhooks yet</NoItemsCard>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className}>
      {data.webhooks.map((webhook) => (
        <WebhookCard key={webhook.id} webhook={webhook} {...rest} />
      ))}
    </Wrapper>
  );
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full flex-col gap-2", className)}>{children}</div>;
}
