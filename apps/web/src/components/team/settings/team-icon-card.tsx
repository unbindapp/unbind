"use client";

import {
  Block,
  BlockItem,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import ErrorLine from "@/components/error-line";
import SettingsCard, { SettingsCardFooterRow } from "@/components/settings/settings-card";
import TeamIcon from "@/components/team/team-icon";
import { useTeam } from "@/components/team/team-provider";
import { useTeams } from "@/components/team/teams-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  deleteTeamIcon as deleteTeamIconFn,
  getTeamIconFileError,
  teamIconAccept,
  updateTeamIcon as updateTeamIconFn,
  type TTeam,
} from "@/lib/queries/teams";
import { useMutation } from "@tanstack/react-query";
import { LoaderIcon, PenIcon, Trash2Icon } from "lucide-react";
import { DragEvent, useRef, useState } from "react";

type TProps = {
  className?: string;
};

export default function TeamIconCard({ className }: TProps) {
  const {
    teamId,
    query: { data, refetch: refetchTeam },
  } = useTeam();
  const { refetch: refetchTeams } = useTeams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const refetch = () => Promise.all([refetchTeam(), refetchTeams()]);

  const upload = useMutation({ mutationFn: updateTeamIconFn, onSuccess: refetch });
  const remove = useMutation({ mutationFn: deleteTeamIconFn, onSuccess: refetch });

  const team = data?.team;
  const canEdit = team?.permissions.includes("editor") ?? false;
  const hasIcon = !!team?.icon_updated_at;
  const isBusy = upload.isPending || remove.isPending;
  const error = fileError ?? upload.error?.message ?? remove.error?.message;

  function onFile(file: File | undefined) {
    if (!file || isBusy) return;
    upload.reset();
    remove.reset();
    const message = getTeamIconFileError(file);
    setFileError(message);
    if (message) return;
    upload.mutate({ teamId, file });
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (!canEdit) return;
    onFile(e.dataTransfer.files[0]);
  }

  return (
    <div
      data-dragging={isDragging || undefined}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsDragging(false);
      }}
      onDrop={onDrop}
      className={cn("group/card w-full", className)}
    >
      <SettingsCard
        className="group-data-dragging/card:border-foreground/30 transition"
        footer={
          <>
            {error && <ErrorLine message={error} />}
            <SettingsCardFooterRow hint="SVG, PNG or JPEG, up to 512 KB">
              {canEdit && hasIcon && (
                <Button
                  type="button"
                  variant="ghost-destructive"
                  disabled={isBusy}
                  onClick={() => {
                    setFileError(null);
                    upload.reset();
                    remove.mutate({ teamId });
                  }}
                  className="gap-1.5 px-4"
                >
                  {remove.isPending ? (
                    <LoaderIcon className="-ml-0.5 size-4.5 shrink-0 animate-spin" />
                  ) : (
                    <Trash2Icon className="-ml-0.5 size-4.5 shrink-0" />
                  )}
                  <p className="min-w-0 shrink">Remove</p>
                </Button>
              )}
            </SettingsCardFooterRow>
          </>
        }
      >
        <Block>
          <BlockItem className="md:w-full">
            <BlockItemContent>
              <div className="flex w-full items-center gap-4">
                <BlockItemHeader type="column" className="min-w-0 flex-1 pb-0">
                  <BlockItemTitle>Team Avatar</BlockItemTitle>
                  <BlockItemDescription>
                    {canEdit
                      ? "Shown next to the team's name. Click it to upload a new one."
                      : "Shown next to the team's name."}
                  </BlockItemDescription>
                </BlockItemHeader>
                {team ? (
                  <IconPicker
                    team={team}
                    canEdit={canEdit}
                    isPending={upload.isPending}
                    disabled={isBusy}
                    onClick={() => inputRef.current?.click()}
                  />
                ) : (
                  <div className="bg-foreground animate-skeleton size-14 shrink-0 rounded-full" />
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept={teamIconAccept}
                  className="hidden"
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      </SettingsCard>
    </div>
  );
}

function IconPicker({
  team,
  canEdit,
  isPending,
  disabled,
  onClick,
}: {
  team: TTeam;
  canEdit: boolean;
  isPending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  if (!canEdit) return <TeamIcon team={team} className="size-14" />;

  return (
    <button
      type="button"
      aria-label="Change team icon"
      data-pending={isPending || undefined}
      disabled={disabled}
      onClick={onClick}
      className="group/picker focus-visible:ring-primary/8-10 relative size-14 shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-default"
    >
      <TeamIcon team={team} className="size-full" />
      <div className="bg-background/10-10 text-foreground pointer-events-none absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition group-focus-visible/picker:opacity-100 group-active/picker:opacity-100 group-data-dragging/card:opacity-100 group-data-pending/picker:opacity-100 has-hover:group-hover/picker:opacity-100">
        {isPending ? (
          <LoaderIcon className="size-5 animate-spin" />
        ) : (
          <PenIcon className="size-5 -rotate-30 transition group-focus-visible/picker:rotate-0 group-active/picker:rotate-0 group-data-dragging/card:rotate-0 has-hover:group-hover/picker:rotate-0" />
        )}
      </div>
    </button>
  );
}
