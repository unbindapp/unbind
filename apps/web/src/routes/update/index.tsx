import { createFileRoute } from "@tanstack/react-router";
import { CircleArrowUpIcon } from "lucide-react";
import { ReactNode } from "react";

import { LinkButton } from "@/components/ui/button";
import {
  useCheckForUpdates,
  useCheckNewVersion,
} from "@/components/update/check-for-updates-provider";
import UpdateAvailableSection from "@/components/update/update-available-section";
import { cn } from "@/components/ui/utils";
import UpdateNotAvailableSection, {
  GoHome,
} from "@/components/update/update-not-available-section";

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
  const { data, isPending, error } = useCheckForUpdates();
  const { hasUpdateAvailable, latestVersion, latestVersionUrl } = useCheckNewVersion();
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

  if (isPending || !hasUpdateAvailable) {
    return (
      <Wrapper data-pending={isPending || undefined} className="group/wrapper">
        <UpdateNotAvailableSection
          {...(isPending
            ? { isPending: true }
            : { isPending: false, currentVersion: data.data.current_version })}
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <UpdateAvailableSection
        latestVersion={latestVersion}
        latestVersionUrl={latestVersionUrl}
        currentVersion={data.data.current_version}
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
