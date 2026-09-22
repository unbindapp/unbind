import { createFileRoute } from "@tanstack/react-router";
import { CircleArrowUpIcon } from "lucide-react";
import { ReactNode } from "react";

import { cn } from "@/components/ui/utils";
import UpdateAvailableSection from "@/components/system/update/update-available-section";
import UpdateNotAvailableSection from "@/components/system/update/update-not-available-section";
import { useUpdateStatus } from "@/components/system/update/update-status-provider";

export const Route = createFileRoute("/system/update/")({
  component: SystemUpdatePage,
});

function SystemUpdatePage() {
  const {
    data,
    isPending,
    error,
    hasUpdateAvailable,
    latestVersion,
    latestVersionUrl,
    phase,
    targetVersion,
  } = useUpdateStatus();

  const isHardError = !data && !isPending && error;

  if (isHardError) {
    return (
      <Wrapper>
        <div className="flex w-full flex-col items-center gap-1.5 px-1">
          <CircleArrowUpIcon className="text-destructive size-8" />
          <h1 className="text-destructive w-full px-2 text-center text-2xl leading-tight font-semibold">
            {"Couldn't check for updates"}
          </h1>
          <p className="text-muted-foreground w-full text-center">
            {error.message || "An unknown error occurred."}
          </p>
        </div>
      </Wrapper>
    );
  }

  if (isPending || !data) {
    return (
      <Wrapper data-pending className="group/wrapper">
        <UpdateNotAvailableSection isPending={true} />
      </Wrapper>
    );
  }

  const status = data.data;
  const showUpdateFlow =
    hasUpdateAvailable || phase !== "idle" || status.in_progress || status.failed;

  if (!showUpdateFlow) {
    return (
      <Wrapper className="group/wrapper">
        <UpdateNotAvailableSection isPending={false} currentVersion={status.current_version} />
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <UpdateAvailableSection
        latestVersion={latestVersion ?? targetVersion ?? status.current_version}
        latestVersionUrl={latestVersionUrl}
        currentVersion={status.current_version}
      />
    </Wrapper>
  );
}

function Wrapper({
  children,
  className,
  ...props
}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-1 flex-col items-center justify-center px-4 pt-12 pb-[calc(3rem+8vh)]",
        className,
      )}
      {...props}
    >
      <div className="flex w-full max-w-lg flex-col items-center justify-center gap-3">
        {children}
      </div>
    </div>
  );
}
