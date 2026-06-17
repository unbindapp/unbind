import { createFileRoute } from "@tanstack/react-router";
import { CircleArrowUpIcon } from "lucide-react";
import { ReactNode } from "react";

import { LinkButton } from "@/components/ui/button";
import { useCheckForUpdates } from "@/components/update/check-for-updates-provider";
import UpdateSection from "@/components/update/update-section";

export const Route = createFileRoute("/_authed/update")({
  component: UpdatePage,
});

function UpdatePage() {
  const { data, isError } = useCheckForUpdates();
  const updateData = data?.data;

  if (isError || !updateData) {
    return (
      <Wrapper>
        <div className="flex w-full flex-col items-center gap-1.5 px-1">
          <CircleArrowUpIcon className="text-destructive size-8" />
          <h1 className="text-destructive w-full px-2 text-center text-2xl leading-tight font-bold">
            {"Couldn't check for updates"}
          </h1>
          <p className="text-muted-foreground w-full text-center">
            Something went wrong. Please try again later.
          </p>
        </div>
        <GoHome />
      </Wrapper>
    );
  }

  if (!updateData.has_update_available || updateData.available_versions.length < 1) {
    return (
      <Wrapper>
        <div className="flex w-full flex-col items-center gap-1.5 px-1">
          <CircleArrowUpIcon className="size-8" />
          <h1 className="w-full px-2 text-center text-2xl leading-tight font-bold">
            No updates available
          </h1>
          <p className="text-muted-foreground w-full text-center">
            You are already on the latest version of Unbind.
          </p>
        </div>
        <GoHome />
        <div className="flex w-full items-center justify-center px-1">
          <p className="text-muted-foreground bg-background-hover max-w-full rounded-full border px-2.5 py-0.5 text-center text-sm font-medium">
            Current version: <span className="font-bold">{updateData.current_version}</span>
          </p>
        </div>
      </Wrapper>
    );
  }

  const versions = updateData.available_versions;
  return (
    <Wrapper>
      <UpdateSection
        latestVersion={versions[versions.length - 1]}
        currentVersion={updateData.current_version}
      />
    </Wrapper>
  );
}

function GoHome() {
  return (
    <div className="flex w-full flex-wrap items-center justify-center">
      <div className="flex w-full px-1 py-1.5 sm:w-1/2">
        <LinkButton to="/" className="w-full">
          Go Home
        </LinkButton>
      </div>
    </div>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pt-6 pb-[calc(2rem+5svh)] sm:pt-8 sm:pb-[calc(2rem+12svh)]">
      <div className="flex w-full max-w-lg flex-col items-center justify-center gap-3">
        {children}
      </div>
    </div>
  );
}
