"use client";

import ApiKeyCard from "@/components/api-key/api-key-card";
import { useApiKeys } from "@/components/api-key/api-keys-provider";
import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { cn } from "@/components/ui/utils";
import { KeySquareIcon } from "lucide-react";
import { ReactNode } from "react";

type TProps = {
  className?: string;
};

const placeholderArray = Array.from({ length: 3 }, (_, i) => i);

export default function ApiKeysList({ className }: TProps) {
  const { data, isPending, error } = useApiKeys();

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
        {placeholderArray.map((_, i) => (
          <ApiKeyCard key={i} type="placeholder" />
        ))}
      </Wrapper>
    );
  }

  if (data && data.apiKeys.length === 0) {
    return (
      <Wrapper className={className}>
        <NoItemsCard Icon={KeySquareIcon}>No API keys yet</NoItemsCard>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className}>
      {data.apiKeys.map((apiKey) => (
        <ApiKeyCard key={apiKey.id} type="key" apiKey={apiKey} />
      ))}
    </Wrapper>
  );
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full flex-col gap-2", className)}>{children}</div>;
}
