"use client";

import ErrorLine from "@/components/error-line";
import { useNow } from "@/components/providers/now-provider";
import { useMainStore } from "@/components/stores/main/main-store-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { useCheckForUpdatesUtils } from "@/components/update/check-for-updates-provider";
import UpdateStatusProvider, { useUpdateStatus } from "@/components/update/update-status-provider";
import { applyUpdate as applyUpdateFn } from "@/lib/queries/system";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CircleArrowUpIcon,
  CircleCheckBigIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HourglassIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type TProps = {
  latestVersion: string;
  latestVersionUrl: string;
  currentVersion: string;
  /** Internal path to return to via Go Back; validated by the /update route's `from` search param. */
  backTo: string;
};

export default function UpdateSection({
  latestVersion,
  latestVersionUrl,
  currentVersion,
  backTo,
}: TProps) {
  const [statusEnabled, setStatusEnabled] = useState(false);
  const setLastDismissedVersion = useMainStore((s) => s.setLastDismissedVersion);

  useEffect(() => {
    setLastDismissedVersion(latestVersion);
  }, [latestVersion, setLastDismissedVersion]);

  return (
    <UpdateStatusProvider enabled={statusEnabled} refetchInterval={5000}>
      <UpdateSectionInner
        latestVersion={latestVersion}
        latestVersionUrl={latestVersionUrl}
        currentVersion={currentVersion}
        backTo={backTo}
        setUpdateStatusEnabled={setStatusEnabled}
      />
    </UpdateStatusProvider>
  );
}

type TPropsInner = TProps & {
  setUpdateStatusEnabled: (enabled: boolean) => void;
};

type TUpdatePhases = "idle" | "updating" | "succeeded" | "failed";

function UpdateSectionInner({
  latestVersion,
  latestVersionUrl,
  currentVersion,
  backTo,
  setUpdateStatusEnabled,
}: TPropsInner) {
  const now = useNow();
  const [updatePhase, setUpdatePhase] = useState<TUpdatePhases>("idle");
  const [updateStartTimestamp, setUpdateStartTimestamp] = useState<number | null>(null);

  const { data: updateStatus } = useUpdateStatus();
  const { invalidate: invalidateCheckForUpdates } = useCheckForUpdatesUtils();

  const {
    mutate: applyUpdate,
    error: errorApplyUpdate,
    isPending: isPendingApplyUpdate,
  } = useMutation({
    mutationFn: applyUpdateFn,
    onSuccess: (d) => {
      if (!d.data.started) {
        throw new Error("Update couldn't start");
      }
      setUpdateStatusEnabled(true);
      setUpdatePhase("updating");
      setUpdateStartTimestamp(Date.now());
    },
  });

  useEffect(() => {
    if (updatePhase !== "updating") return;
    if (!updateStatus?.data.ready) return;

    setUpdatePhase("succeeded");
    setUpdateStatusEnabled(false);
  }, [updatePhase, updateStatus, setUpdateStatusEnabled]);

  // Invalidating while the succeeded screen is up would flip has_update_available
  // to false and swap this screen for "No updates available", so wait for unmount.
  const updatePhaseRef = useRef(updatePhase);
  updatePhaseRef.current = updatePhase;
  useEffect(() => {
    return () => {
      if (updatePhaseRef.current === "succeeded") invalidateCheckForUpdates();
    };
  }, [invalidateCheckForUpdates]);

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
          <HourglassIcon className="animate-hourglass-long text-process touch: absolute top-0 left-0 size-full scale-80 opacity-0 transition group-data-[phase=updating]/section:opacity-100" />
          <CircleCheckBigIcon className="text-success absolute top-0 left-0 size-full opacity-0 transition group-data-[phase=succeeded]/section:opacity-100" />
        </div>
        <h1 className="w-full px-2 text-center text-2xl leading-tight font-medium">
          {updatePhase === "idle" && (
            <span>
              Update to <span className="text-success font-bold">{latestVersion}</span>
            </span>
          )}
          {updatePhase === "updating" && (
            <span>
              Updating to <span className="text-process font-bold">{latestVersion}</span>
            </span>
          )}
          {updatePhase === "succeeded" && (
            <span className="text-success">Updated to {latestVersion}</span>
          )}
        </h1>
        {updatePhase === "idle" && (
          <div className="mt-0.5 flex w-full items-center justify-center px-1">
            <p className="text-muted-foreground bg-background-hover max-w-full rounded-full border px-2.5 py-0.5 text-center text-sm font-medium">
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
        </p>
      </div>

      <div className="flex w-full flex-wrap items-center justify-center">
        {updatePhase === "idle" && (
          <>
            <div className="flex w-full px-1 py-1.5 sm:w-1/2">
              <LinkButton to={backTo} variant="outline" className="text-muted-foreground w-full">
                <ArrowLeftIcon className="size-4.5 shrink-0" />
                <p className="min-w-0 shrink">Go Back</p>
              </LinkButton>
            </div>
            <div className="flex w-full px-1 py-1.5 sm:w-1/2">
              <Button
                isPending={isPendingApplyUpdate}
                onClick={() => applyUpdate(latestVersion)}
                className="w-full"
              >
                <CircleArrowUpIcon className="size-4.5 shrink-0" />
                <p className="min-w-0 shrink">Update Now</p>
              </Button>
            </div>
            <div className="flex w-full px-1 py-1.5 sm:w-1/2">
              <Button
                variant="ghost"
                className="text-muted-foreground group w-full cursor-pointer"
                asChild
              >
                <a href={latestVersionUrl} target="_blank" rel="noopener noreferrer">
                  <div className="relative size-4.5 shrink-0">
                    <FileTextIcon className="size-full transition-[rotate,opacity] group-hover:rotate-90 group-hover:opacity-0 group-active:rotate-90 group-active:opacity-0" />
                    <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-[rotate,opacity] group-hover:rotate-0 group-hover:opacity-100 group-active:rotate-0 group-active:opacity-100" />
                  </div>
                  <p className="min-w-0 shrink">Changelog</p>
                </a>
              </Button>
            </div>
          </>
        )}
        {updatePhase === "updating" && (
          <div className="mt-1.5 flex w-full flex-col items-center gap-2">
            <div className="bg-border relative h-3 w-full items-center justify-center overflow-hidden rounded-lg border">
              <div className="from-process/0 via-process to-process/0 animate-ping-pong-long absolute top-1/2 left-1/2 aspect-square w-[110%] origin-center -translate-1/2 bg-linear-to-r" />
            </div>
            <p className="max-w-full text-center font-mono text-xl leading-tight font-semibold">
              {updateDurationStr}
            </p>
          </div>
        )}
        {updatePhase === "succeeded" && (
          <div className="flex w-full px-1 py-1.5 sm:w-1/2">
            <Button asChild className="w-full">
              <a href="/">Go Home</a>
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
