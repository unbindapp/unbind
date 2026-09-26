"use client";

import ErrorCard from "@/components/error-card";
import GithubAppCard, { type TGithubAppCardView } from "@/components/git/github-app-card";
import { useGithubApps } from "@/components/git/github-apps-provider";
import BrandIcon from "@/components/icons/brand";
import NoItemsCard from "@/components/no-items-card";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type TProps = {
  view: TGithubAppCardView;
  canEditTeam?: boolean;
  className?: string;
  children?: ReactNode;
};

const placeholderArray = Array.from({ length: 2 }, (_, i) => i);

export default function GithubAppsList({ view, canEditTeam, className, children }: TProps) {
  const {
    query: { data, isPending, error },
  } = useGithubApps();

  if (!data && !isPending && error) {
    return (
      <Wrapper className={className}>
        <ErrorCard message={error.message} />
        {children}
      </Wrapper>
    );
  }

  if (!data && isPending) {
    return (
      <Wrapper className={className}>
        {placeholderArray.map((_, i) => (
          <GithubAppCard key={i} view={view} isPlaceholder={true} />
        ))}
      </Wrapper>
    );
  }

  if (data && data.apps.length === 0) {
    return (
      <Wrapper className={className}>
        <NoItemsCard Icon={({ className }) => <BrandIcon brand="github" className={className} />}>
          {view === "account"
            ? "No GitHub Apps yet"
            : "No GitHub Apps are shared with this team yet"}
        </NoItemsCard>
        {children}
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className}>
      {data.apps.map((app) => (
        <GithubAppCard key={app.uuid} app={app} view={view} canEditTeam={canEditTeam} />
      ))}
      {children}
    </Wrapper>
  );
}

function Wrapper({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex w-full flex-col gap-2", className)}>{children}</div>;
}
