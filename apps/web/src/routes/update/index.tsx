import { createFileRoute } from "@tanstack/react-router";
import { CircleArrowUpIcon } from "lucide-react";
import { ReactNode, useRef } from "react";

import { cn } from "@/components/ui/utils";
import UpdateAvailableSection from "@/components/update/update-available-section";
import UpdateNotAvailableSection, {
  GoHome,
} from "@/components/update/update-not-available-section";
import { useUpdateStatus } from "@/components/update/update-status-provider";

type TUpdateSearch = { from?: string };

// Only accept internal paths so the Go Back link can never point outside the app.
function validateSearch(search: Record<string, unknown>): TUpdateSearch {
  const from = search.from;
  if (typeof from === "string" && from.startsWith("/") && !from.startsWith("//")) {
    return { from };
  }
  return {};
}

export const Route = createFileRoute("/update/")({
  validateSearch,
  component: UpdatePage,
});

function UpdatePage() {
  const { from } = Route.useSearch();
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
        <GoHome />
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
        backTo={from ?? "/"}
      />
    </Wrapper>
  );
}

// This should have all div props
function Wrapper({
  children,
  className,
  ...props
}: { children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col items-center justify-center px-4 pt-6 pb-[calc(2rem+5svh)] sm:pt-8 sm:pb-[calc(2rem+12svh)]",
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
