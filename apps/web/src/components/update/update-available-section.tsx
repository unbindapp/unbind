"use client";

import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useNow } from "@/components/providers/now-provider";
import { useMainStore } from "@/components/stores/main/main-store-provider";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button, LinkButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import UpdateStatusProvider, {
  useUpdateStatus,
  useUpdateStatusUtils,
} from "@/components/update/update-status-provider";
import { applyUpdate as applyUpdateFn } from "@/lib/queries/system";
import type { Change } from "@/lib/server/client.gen";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CircleArrowUpIcon,
  CircleCheckBigIcon,
  CircleXIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HourglassIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const longUpdateThresholdMs = 15 * 60 * 1000;

type TProps = {
  latestVersion: string;
  latestVersionUrl: string | null;
  currentVersion: string;
  /** Internal path to return to via Go Back; validated by the /update route's `from` search param. */
  backTo: string;
};

export default function UpdateAvailableSection(props: TProps) {
  const { data } = useUpdateStatus();
  const setLastDismissedVersion = useMainStore((s) => s.setLastDismissedVersion);

  // Fast polling only runs while an update is being watched; starts on when the
  // page loads into an update already in progress on the server.
  const [isWatchingUpdate, setIsWatchingUpdate] = useState(() => !!data?.data.in_progress);

  const { latestVersion } = props;
  useEffect(() => {
    setLastDismissedVersion(latestVersion);
    toast.close("update_toast");
  }, [latestVersion, setLastDismissedVersion]);

  return (
    <UpdateStatusProvider refetchInterval={isWatchingUpdate ? 5000 : undefined}>
      <UpdateSectionInner {...props} setIsWatchingUpdate={setIsWatchingUpdate} />
    </UpdateStatusProvider>
  );
}

type TPropsInner = TProps & {
  setIsWatchingUpdate: (watching: boolean) => void;
};

type TUpdatePhases = "idle" | "updating" | "succeeded" | "failed";

function UpdateSectionInner({
  latestVersion,
  latestVersionUrl,
  currentVersion,
  backTo,
  setIsWatchingUpdate,
}: TPropsInner) {
  const now = useNow();

  const {
    data: updateStatusData,
    dataUpdatedAt,
    latestVersionSummary,
    latestVersionChanges,
  } = useUpdateStatus();
  const { refetch: refetchUpdateStatus } = useUpdateStatusUtils();
  const setLastUpdatedAndDismissedVersion = useMainStore(
    (s) => s.setLastUpdatedAndDismissedVersion,
  );
  const updateStatus = updateStatusData?.data;

  const [updatePhase, setUpdatePhase] = useState<TUpdatePhases>(() => {
    if (updateStatus?.in_progress) return "updating";
    if (updateStatus?.failed) return "failed";
    return "idle";
  });
  const [updateStartTimestamp, setUpdateStartTimestamp] = useState<number | null>(() =>
    updateStatus?.in_progress ? Date.now() : null,
  );

  const {
    mutate: applyUpdate,
    error: errorApplyUpdate,
    isPending: isPendingApplyUpdate,
  } = useMutation({
    mutationFn: applyUpdateFn,
    onSuccess: () => {
      setIsWatchingUpdate(true);
      setUpdatePhase("updating");
      setUpdateStartTimestamp(Date.now());
      refetchUpdateStatus();
    },
  });

  // On a resumed update the server's target is the truth, not the latest release.
  const targetVersion = updateStatus?.target_version || latestVersion;

  // Pick up an update started elsewhere (another tab or admin) while idling here.
  useEffect(() => {
    if (updatePhase !== "idle") return;
    if (!updateStatus?.in_progress) return;

    setUpdatePhase("updating");
    setIsWatchingUpdate(true);
    setUpdateStartTimestamp((t) => t ?? Date.now());
  }, [updatePhase, updateStatus, setIsWatchingUpdate]);

  // `ready` can come from a status snapshot cached before the update started, so only
  // trust it when the server binary already runs the version we're updating to.
  useEffect(() => {
    if (updatePhase !== "updating") return;
    if (!updateStatus?.ready) return;
    if (updateStatus.current_version !== targetVersion) return;

    setUpdatePhase("succeeded");
    setIsWatchingUpdate(false);
    // The person who ran the update saw the changelog already; skip the updated toast.
    setLastUpdatedAndDismissedVersion(targetVersion);
  }, [
    updatePhase,
    updateStatus,
    targetVersion,
    setIsWatchingUpdate,
    setLastUpdatedAndDismissedVersion,
  ]);

  // The timestamp guard skips failed snapshots fetched before a retry started.
  useEffect(() => {
    if (updatePhase === "succeeded" || updatePhase === "failed") return;
    if (!updateStatus?.failed) return;
    if (updateStartTimestamp !== null && dataUpdatedAt <= updateStartTimestamp) return;

    setUpdatePhase("failed");
    setIsWatchingUpdate(false);
  }, [updatePhase, updateStatus, dataUpdatedAt, updateStartTimestamp, setIsWatchingUpdate]);

  const isTakingLong =
    updatePhase === "updating" &&
    updateStartTimestamp !== null &&
    now - updateStartTimestamp > longUpdateThresholdMs;

  const updateDurationStr = useMemo(() => {
    if (!updateStartTimestamp) return "00:00";

    const differenceMs = Math.max(0, now - updateStartTimestamp);
    const seconds = Math.floor((differenceMs % (1000 * 60)) / 1000);
    const minutes = Math.floor(differenceMs / (1000 * 60));

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, [now, updateStartTimestamp]);

  return (
    <>
      <div
        data-phase={updatePhase}
        className="group/section flex w-full flex-col items-center gap-1.5 px-1"
      >
        <div className="relative size-8 transition group-data-[phase=updating]/section:rotate-180">
          <CircleArrowUpIcon className="size-full opacity-0 transition group-data-[phase=idle]/section:opacity-100" />
          <HourglassIcon className="animate-hourglass-long text-process absolute top-0 left-0 size-full opacity-0 transition group-data-[phase=updating]/section:opacity-100" />
          <CircleCheckBigIcon className="text-success absolute top-0 left-0 size-full opacity-0 transition group-data-[phase=succeeded]/section:opacity-100" />
          <CircleXIcon className="text-destructive absolute top-0 left-0 size-full opacity-0 transition group-data-[phase=failed]/section:opacity-100" />
        </div>
        <h1 className="w-full px-2 text-center text-2xl leading-tight font-medium">
          {updatePhase === "idle" && (
            <span>
              Update to <span className="text-success font-bold">{latestVersion}</span>
            </span>
          )}
          {updatePhase === "updating" && (
            <span>
              Updating to <span className="text-process font-bold">{targetVersion}</span>
            </span>
          )}
          {updatePhase === "succeeded" && (
            <span className="text-success">Updated to {targetVersion}</span>
          )}
          {updatePhase === "failed" && (
            <span className="text-destructive">Update to {targetVersion} failed</span>
          )}
        </h1>
        {updatePhase === "idle" && (
          <div className="mt-0.5 flex w-full items-center justify-center px-1">
            <p className="text-muted-foreground bg-card max-w-full rounded-full border px-2.5 py-0.5 text-center text-sm font-medium">
              Current version: <span className="font-bold">{currentVersion}</span>
            </p>
          </div>
        )}
        <p className="text-muted-foreground mt-2 w-full group-data-[phase=succeeded]/section:text-center">
          {updatePhase === "idle" &&
            "The process will take a few minutes. During the update your services will continue to run but Unbind's UI and API will be down."}
          {updatePhase === "updating" &&
            "You can close this page and come back after a few minutes. Unbind UI and API might be unavailable for a short while."}
          {updatePhase === "succeeded" && "Unbind has been updated successfully."}
          {updatePhase === "failed" &&
            "The update didn't complete. Your services are unaffected and you can retry the update."}
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center">
        {updatePhase === "idle" && (
          <div className="flex w-full flex-wrap items-center justify-center">
            <div className="flex w-full px-1 py-1.5 sm:w-1/2">
              <LinkButton to={backTo} variant="outline" className="text-muted-foreground w-full">
                <ArrowLeftIcon className="size-4.5 shrink-0" />
                <p className="min-w-0 shrink">Go Back</p>
              </LinkButton>
            </div>
            <div className="order-first flex w-full px-1 py-1.5 sm:order-0 sm:w-1/2">
              <Button
                isPending={isPendingApplyUpdate}
                onClick={() => applyUpdate(latestVersion)}
                className="w-full"
              >
                <CircleArrowUpIcon className="size-4.5 shrink-0" />
                <p className="min-w-0 shrink">Update Now</p>
              </Button>
            </div>
            <div className="flex w-full px-1 py-1.5">
              <Changelog
                summary={latestVersionSummary}
                changes={latestVersionChanges}
                releaseUrl={latestVersionUrl}
              />
            </div>
          </div>
        )}
        {updatePhase === "updating" && (
          <div className="mt-1.5 flex w-full flex-col items-center gap-2">
            <div className="bg-border relative h-3 w-full items-center justify-center overflow-hidden rounded-lg border">
              <div className="from-process/0 via-process to-process/0 animate-ping-pong-long absolute top-1/2 left-1/2 aspect-square w-[110%] origin-center -translate-1/2 bg-linear-to-r" />
            </div>
            <p className="max-w-full text-center font-mono text-xl leading-tight font-semibold">
              {updateDurationStr}
            </p>
            {isTakingLong && (
              <p className="text-muted-foreground w-full px-1 text-center text-sm">
                This is taking longer than expected. The update may still be rolling out. If it
                doesn't complete soon, check the Unbind deployments in your cluster.
              </p>
            )}
          </div>
        )}
        {updatePhase === "failed" && (
          <div className="flex w-full flex-wrap items-center justify-center">
            <div className="flex w-full px-1 py-1.5 sm:w-1/2">
              <LinkButton to={backTo} variant="outline" className="text-muted-foreground w-full">
                <ArrowLeftIcon className="size-4.5 shrink-0" />
                <p className="min-w-0 shrink">Go Back</p>
              </LinkButton>
            </div>
            <div className="order-first flex w-full px-1 py-1.5 sm:order-0 sm:w-1/2">
              <Button
                isPending={isPendingApplyUpdate}
                onClick={() => applyUpdate(targetVersion)}
                className="w-full"
              >
                <RotateCcwIcon className="size-4.5 shrink-0" />
                <p className="min-w-0 shrink">Retry Update</p>
              </Button>
            </div>
            {updateStatus?.message && (
              <div className="flex w-full px-1 py-1.5">
                <ErrorLine className="w-full" message={updateStatus.message} />
              </div>
            )}
          </div>
        )}
        {updatePhase === "succeeded" && (
          <div className="flex w-full px-1 py-1.5 sm:w-1/2">
            <Button render={<a href="/" />} className="w-full">
              Go Home
            </Button>
          </div>
        )}
        {errorApplyUpdate && (
          <div className="flex w-full px-1 py-1.5">
            <ErrorLine className="w-full" message={errorApplyUpdate.message} />
          </div>
        )}
      </div>
    </>
  );
}

function Changelog({
  summary,
  changes,
  releaseUrl,
}: {
  summary: string | null;
  changes: Change[];
  releaseUrl: string | null;
}) {
  return (
    <Accordion className="bg-card overflow-hidden rounded-lg border">
      <AccordionItem value="changes">
        <AccordionTrigger>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden sm:px-0.75 sm:py-1">
            <div className="flex items-center gap-1.5">
              <FileTextIcon className="size-4.5 shrink-0" />
              <p className="min-w-0 shrink leading-tight font-semibold wrap-break-word">
                Changelog
              </p>
            </div>
            {summary && (
              <p className="text-muted-foreground min-w-0 text-sm font-normal">{summary}</p>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3 border-t pt-3.5 pb-4">
          {releaseUrl && (
            <Button
              className="group w-full"
              variant="outline"
              render={<a href={releaseUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <div className="relative size-4.5 shrink-0 transition-[rotate,opacity] group-active:rotate-45 has-hover:group-hover:rotate-45">
                <BrandIcon
                  brand="github"
                  color="monochrome"
                  className="size-full group-active:opacity-0 has-hover:group-hover:opacity-0"
                />
                <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active:opacity-100 has-hover:group-hover:opacity-100" />
              </div>
              <p className="min-w-0 shrink">View on GitHub</p>
            </Button>
          )}
          {changes.length === 0 ? (
            <p className="text-muted-foreground text-sm sm:px-1">
              There is no changelog for this release.
            </p>
          ) : (
            <ul className="flex w-full min-w-0 flex-col gap-3 sm:px-1">
              {changes.map((change, i) => (
                <li
                  key={`${change.commit_sha ?? ""}-${i}`}
                  className="flex w-full min-w-0 items-start gap-2 text-sm"
                >
                  <span className="bg-muted-more-foreground mt-2 size-1 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 shrink flex-col gap-0.5">
                    <p className="min-w-0 shrink">{change.message}</p>
                    {change.commit_sha && change.commit_url && (
                      <a
                        href={change.commit_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-more-foreground has-hover:hover:text-muted-foreground active:text-muted-foreground min-w-0 shrink font-mono text-xs wrap-break-word active:underline has-hover:hover:underline"
                      >
                        {change.commit_sha.slice(0, 7)}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
