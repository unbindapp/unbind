"use client";

import { useUpdateStatus } from "@/components/system/update/update-status-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/components/ui/utils";
import { checkForUpdates, queryKeySystem } from "@/lib/queries/system";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  GiftIcon,
  LoaderIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useEffect } from "react";

const resultVisibleMs = 3000;

type TCheckState = "idle" | "checking" | "up-to-date" | "update-available" | "failed";

const checkStates: Record<TCheckState, { label: string; Icon: typeof RefreshCwIcon }> = {
  idle: { label: "Check for updates", Icon: RefreshCwIcon },
  checking: { label: "Checking", Icon: LoaderIcon },
  "up-to-date": { label: "Up to date", Icon: CircleCheckIcon },
  "update-available": { label: "Update available", Icon: GiftIcon },
  failed: { label: "Check failed", Icon: TriangleAlertIcon },
};

function useCheckForUpdates() {
  const queryClient = useQueryClient();
  const { hasUpdateAvailable } = useUpdateStatus();
  const { mutate, status, reset } = useMutation({
    mutationFn: checkForUpdates,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeySystem.updateStatus(), data);
    },
  });

  const state: TCheckState =
    status === "pending"
      ? "checking"
      : status === "error"
        ? "failed"
        : status === "success"
          ? hasUpdateAvailable
            ? "update-available"
            : "up-to-date"
          : "idle";

  // An available update stays until the menu closes, so the row can lead to it.
  useEffect(() => {
    if (state !== "up-to-date" && state !== "failed") return;
    const timeout = setTimeout(reset, resultVisibleMs);
    return () => clearTimeout(timeout);
  }, [state, reset]);

  const check = () => {
    if (status === "pending") return;
    mutate();
  };

  return { state, check };
}

export default function CheckForUpdatesButton({
  variant,
  onUpdateClicked,
}: {
  variant: "dropdown-menu-item" | "drawer-item";
  onUpdateClicked: () => void;
}) {
  const navigate = useNavigate();
  const { state, check } = useCheckForUpdates();
  const { label, Icon } = checkStates[state];

  const onClick = () => {
    if (state !== "update-available") {
      check();
      return;
    }
    onUpdateClicked();
    navigate({ to: "/system/update" });
  };

  const content = (
    <>
      <Icon className={cn("-ml-px size-3.75 shrink-0", state === "checking" && "animate-spin")} />
      <p className="min-w-0 shrink text-sm leading-tight">{label}</p>
    </>
  );

  const className = cn(
    "text-muted-foreground flex w-full items-center text-left leading-tight",
    (state === "idle" || state === "checking") &&
      "has-hover:hover:text-foreground active:text-foreground data-highlighted:text-foreground",
    (state === "up-to-date" || state === "update-available") && "text-success",
    state === "failed" && "text-destructive",
  );

  if (variant === "drawer-item") {
    return (
      <Button
        onClick={onClick}
        variant="ghost"
        className={cn(
          className,
          "hover:bg-border active:bg-border justify-start gap-1.25 rounded-none px-4.25 py-3",
        )}
      >
        {content}
      </Button>
    );
  }

  return (
    <DropdownMenuItem
      closeOnClick={false}
      onClick={onClick}
      className={cn(className, "cursor-pointer gap-1.5 px-3 py-2")}
    >
      {content}
    </DropdownMenuItem>
  );
}
