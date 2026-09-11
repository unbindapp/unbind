import { createFileRoute } from "@tanstack/react-router";
import { CircleArrowUpIcon } from "lucide-react";
import { ReactNode, useRef } from "react";

import { cn } from "@/components/ui/utils";
import UpdateAvailableSection from "@/components/update/update-available-section";
import UpdateNotAvailableSection from "@/components/update/update-not-available-section";
import { useUpdateStatus } from "@/components/update/update-status-provider";

export const Route = createFileRoute("/system/update/")({
  component: SystemUpdatePage,
});

function SystemUpdatePage() {
  const { data, isPending, error, hasUpdateAvailable, latestVersion, latestVersionUrl } =
    useUpdateStatus();

  // Once the update flow is on screen, keep it there: a background refetch after a
  // successful update flips has_update_available to false, and swapping to
  // "No updates available" would eat the success screen.
  const showedUpdateFlowRef = useRef(false);

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
  if (hasUpdateAvailable || status.in_progress || status.failed) {
    showedUpdateFlowRef.current = true;
  }

  if (!showedUpdateFlowRef.current) {
    return (
      <Wrapper className="group/wrapper">
        <UpdateNotAvailableSection isPending={false} currentVersion={status.current_version} />
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <UpdateAvailableSection
        latestVersion={latestVersion ?? status.target_version ?? status.current_version}
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
        "relative flex w-full flex-1 flex-col items-center px-4 pt-10 pb-16 sm:pt-16",
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
