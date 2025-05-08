import UpdateSection from "@/app/(default)/update/_components/update-section";
import { LinkButton } from "@/components/ui/button";
import { auth } from "@/server/auth/auth";
import { apiServer } from "@/server/trpc/setup/server";
import { CircleArrowUpIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { redirect } from "next/navigation";

export default async function Page() {
  const user = await auth();
  if (!user) {
    redirect("/");
  }

  const versionResult = await ResultAsync.fromPromise(
    apiServer.system.checkForUpdates(),
    () => new Error("Failed to fetch version data"),
  );

  if (versionResult.isErr()) {
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
        <div className="flex w-full flex-wrap items-center justify-center">
          <div className="flex w-full px-1 py-1.5 sm:w-1/2">
            <LinkButton href="/" className="w-full">
              Go Home
            </LinkButton>
          </div>
        </div>
      </Wrapper>
    );
  }

  if (
    !versionResult.value.data.has_update_available ||
    versionResult.value.data.available_versions.length < 1
  ) {
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
        <div className="flex w-full flex-wrap items-center justify-center">
          <div className="flex w-full px-1 py-1.5 sm:w-1/2">
            <LinkButton href="/" className="w-full">
              Go Home
            </LinkButton>
          </div>
        </div>
        <div className="flex w-full items-center justify-center px-1">
          <p className="text-muted-foreground bg-background-hover max-w-full rounded-full border px-2.5 py-0.5 text-center text-sm font-medium">
            Current version:{" "}
            <span className="font-bold">{versionResult.value.data.current_version}</span>
          </p>
        </div>
      </Wrapper>
    );
  }

  const versions = versionResult.value.data.available_versions;
  const currentVersion = versionResult.value.data.current_version;
  const latestVersion = versions[versions.length - 1];

  return (
    <Wrapper>
      <UpdateSection latestVersion={latestVersion} currentVersion={currentVersion} />
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pt-6 pb-[calc(2rem+5svh)] sm:pt-8 sm:pb-[calc(2rem+12svh)]">
      <div className="flex w-full max-w-lg flex-col items-center justify-center gap-3">
        {children}
      </div>
    </div>
  );
}
