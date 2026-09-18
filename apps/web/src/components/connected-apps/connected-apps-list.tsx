"use client";

import ConnectedAppCard from "@/components/connected-apps/connected-app-card";
import { useConnectedApps } from "@/components/connected-apps/connected-apps-provider";
import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import { cn } from "@/components/ui/utils";
import { PlugZapIcon } from "lucide-react";
import { ReactNode } from "react";

type TProps = {
  className?: string;
};

const placeholderArray = Array.from({ length: 3 }, (_, i) => i);

export default function ConnectedAppsList({ className }: TProps) {
  const { data, isPending, error } = useConnectedApps();

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
          <ConnectedAppCard key={i} isPlaceholder={true} />
        ))}
      </Wrapper>
    );
  }

  if (data && data.connectedApps.length === 0) {
    return (
      <Wrapper className={className}>
        <NoItemsCard Icon={PlugZapIcon}>No connected apps yet</NoItemsCard>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className}>
      {data.connectedApps.map((connectedApp) => (
        <ConnectedAppCard key={connectedApp.id} connectedApp={connectedApp} />
      ))}
    </Wrapper>
  );
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full flex-col gap-2", className)}>{children}</div>;
}
