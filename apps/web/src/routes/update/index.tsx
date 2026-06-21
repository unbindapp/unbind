import { createFileRoute } from "@tanstack/react-router";
import { CircleArrowUpIcon } from "lucide-react";
import { ReactNode } from "react";

import { LinkButton } from "@/components/ui/button";
import { useCheckForUpdates } from "@/components/update/check-for-updates-provider";
import UpdateSection from "@/components/update/update-section";
import { cn } from "@/components/ui/utils";

export const Route = createFileRoute("/update/")({
  component: UpdatePage,
});

function UpdatePage() {
  const { data, isPending, error } = useCheckForUpdates();
  const isHardError = !data && !isPending && error;

  if (isHardError) {
    return (
      <Wrapper>
        <div className="flex w-full flex-col items-center gap-1.5 px-1">
          <CircleArrowUpIcon className="text-destructive size-8" />
          <h1 className="text-destructive w-full px-2 text-center text-2xl leading-tight font-bold">
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

  if (isPending || data.data.has_update_available || data.data.available_versions.length < 1) {
    return (
      <Wrapper data-pending={isPending || undefined} className="group/wrapper">
        <div className="flex w-full flex-col items-center gap-1.5 px-1">
          <CircleArrowUpIcon className="group-data-pending/wrapper:animate-skeleton group-data-pending/wrapper:bg-muted-foreground size-8 group-data-pending/wrapper:rounded-full group-data-pending/wrapper:text-transparent" />
          <h1 className="group-data-pending/wrapper:animate-skeleton group-data-pending/wrapper:bg-muted-foreground max-w-full px-2 text-center text-2xl leading-tight font-bold group-data-pending/wrapper:rounded-md group-data-pending/wrapper:text-transparent">
            No updates available
          </h1>
          <p className="text-muted-foreground group-data-pending/wrapper:animate-skeleton group-data-pending/wrapper:bg-muted-more-foreground max-w-full text-center group-data-pending/wrapper:rounded-md group-data-pending/wrapper:text-transparent">
            You are already on the latest version of Unbind.
          </p>
        </div>
        <GoHome isPending={isPending} />
        <div className="flex w-full items-center justify-center px-1">
          <p className="text-muted-foreground group-data-pending/wrapper:animate-skeleton group-data-pending/wrapper:bg-muted-more-foreground max-w-full rounded-full border px-2.5 py-0.5 text-center text-sm font-medium group-data-pending/wrapper:text-transparent">
            Current version:{" "}
            <span className="font-bold">{isPending ? "a1a1a1a" : data.data.current_version}</span>
          </p>
        </div>
      </Wrapper>
    );
  }

  const versions = data.data.available_versions;
  return (
    <Wrapper>
      <UpdateSection
        latestVersion={versions[versions.length - 1]}
        currentVersion={data.data.current_version}
      />
    </Wrapper>
  );
}

function GoHome({ isPending }: { isPending?: boolean }) {
  return (
    <div
      data-pending={isPending || undefined}
      className="group/div flex w-full flex-wrap items-center justify-center"
    >
      <div className="flex w-full px-1 py-1.5 sm:w-1/2">
        <LinkButton
          disabled={isPending}
          to="/"
          className="group-data-pending/div:animate-skeleton group-data-pending/div:bg-muted-foreground w-full group-data-pending/div:text-transparent"
        >
          Go Home
        </LinkButton>
      </div>
    </div>
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
