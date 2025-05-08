"use client";

import ErrorLine from "@/components/error-line";
import { useNow } from "@/components/providers/now-provider";
import { Button, LinkButton } from "@/components/ui/button";
import UpdateStatusProvider, { useUpdateStatus } from "@/components/update/update-status-provider";
import { api } from "@/server/trpc/setup/client";
import { CircleArrowUpIcon, CircleCheckBigIcon, HourglassIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TProps = {
  latestVersion: string;
  currentVersion: string;
};

export default function UpdateSection({ latestVersion, currentVersion }: TProps) {
  const [statusEnabled, setStatusEnabled] = useState(false);
  return (
    <UpdateStatusProvider enabled={statusEnabled} refetchInterval={5000}>
      <UpdateSectionInner
        latestVersion={latestVersion}
        currentVersion={currentVersion}
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
  currentVersion,
  setUpdateStatusEnabled,
}: TPropsInner) {
  const now = useNow();
  const [updatePhase, setUpdatePhase] = useState<TUpdatePhases>("idle");
  const [updateStartTimestamp, setUpdateStartTimestamp] = useState<number | null>(null);

  const { data: updateStatus } = useUpdateStatus();

  const {
    mutate: applyUpdate,
    error: errorApplyUpdate,
    isPending: isPendingApplyUpdate,
  } = api.system.applyUpdate.useMutation({
    onSuccess: (d) => {
      if (d.data.started) {
        setUpdateStatusEnabled(true);
        setUpdatePhase("updating");
        setUpdateStartTimestamp(Date.now());
      } else {
        throw new Error("Update failed to start");
      }
    },
  });

  useEffect(() => {
    if (updatePhase !== "updating") return;
    if (updateStatus?.data.ready) {
      setUpdatePhase("succeeded");
      setUpdateStatusEnabled(false);
    }
  }, [updatePhase, updateStatus, setUpdateStatusEnabled]);

  const updateDurationStr = useMemo(() => {
    if (!updateStartTimestamp) return "00:00";
    const differenceMs = Math.max(0, now - updateStartTimestamp);
    const seconds = Math.floor((differenceMs % (1000 * 60)) / 1000);
    const minutes = Math.floor((differenceMs % (1000 * 60 * 60)) / (1000 * 60));
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
        <h1 className="w-full px-2 text-center text-2xl leading-tight font-bold">
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
        <p className="text-muted-foreground w-full group-data-[phase=succeeded]/section:text-center">
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
              <LinkButton href="/" variant="outline" className="text-muted-foreground w-full">
                Do it later
              </LinkButton>
            </div>
            <div className="flex w-full px-1 py-1.5 sm:w-1/2">
              <Button
                isPending={isPendingApplyUpdate}
                onClick={() => applyUpdate({ target_version: latestVersion })}
                className="w-full"
              >
                Update Now
              </Button>
            </div>
          </>
        )}
        {updatePhase === "updating" && (
          <div className="mt-1.5 flex w-full flex-col items-center gap-2">
            <div className="bg-border relative h-3 w-full items-center justify-center overflow-hidden rounded-lg border">
              <div className="from-process/0 via-process to-process/0 animate-ping-pong-long absolute top-1/2 left-1/2 aspect-square w-[120%] origin-center -translate-1/2 bg-gradient-to-r" />
            </div>
            <p className="max-w-full text-center font-mono text-xl leading-tight font-semibold">
              {updateDurationStr}
            </p>
          </div>
        )}
        {updatePhase === "succeeded" && (
          <div className="flex w-full px-1 py-1.5 sm:w-1/2">
            <LinkButton href="/" className="w-full">
              Go Home
            </LinkButton>
          </div>
        )}
        {errorApplyUpdate && (
          <div className="flex w-full px-1 py-1.5">
            <ErrorLine className="w-full" message={errorApplyUpdate.message} />
          </div>
        )}
      </div>
      {updatePhase === "idle" && (
        <div className="flex w-full items-center justify-center px-1">
          <p className="text-muted-foreground bg-background-hover max-w-full rounded-full border px-2.5 py-0.5 text-center text-sm font-medium">
            Current version: <span className="font-bold">{currentVersion}</span>
          </p>
        </div>
      )}
    </>
  );
}
