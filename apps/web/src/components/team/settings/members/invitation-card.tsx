"use client";

import { roleTitle } from "@/components/team/settings/members/role-select";
import { useTeamMembersUtils } from "@/components/team/settings/members/team-members-provider";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import {
  revokeTeamInvitation as revokeTeamInvitationFn,
  type TTeamInvitation,
} from "@/lib/queries/teams";
import { useMutation } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { MailIcon, Trash2Icon } from "lucide-react";

export default function InvitationCard({ invitation }: { invitation: TTeamInvitation }) {
  const { invalidate } = useTeamMembersUtils();
  const {
    mutateAsync: revoke,
    error,
    reset,
  } = useMutation({ mutationFn: revokeTeamInvitationFn, onSuccess: () => invalidate() });

  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 sm:px-4">
      <div className="flex min-w-0 shrink items-center gap-2 leading-tight">
        <div className="line-icon">
          <MailIcon className="text-muted-foreground size-4.5" />
        </div>
        <div className="flex min-w-0 shrink flex-col gap-0.5">
          <p className="min-w-0 truncate font-medium">{invitation.email}</p>
          <p className="text-muted-foreground min-w-0 truncate text-sm">
            {roleTitle(invitation.role)} · expires in{" "}
            {formatDistanceToNowStrict(new Date(invitation.expires_at))}
          </p>
        </div>
      </div>
      <DeleteEntityTrigger
        dialogTitle="Revoke Invitation"
        dialogDescription="The invitation link stops working right away."
        disableConfirmationInput
        submitButtonText="Revoke"
        deletingEntityName={invitation.email}
        onDialogClose={reset}
        error={error}
        onSubmit={async () => {
          await revoke({ teamId: invitation.team_id, invitationId: invitation.id });
        }}
      >
        <Button
          aria-label="Revoke invitation"
          variant="ghost"
          size="icon"
          className="text-muted-more-foreground has-hover:hover:text-destructive shrink-0 rounded-lg"
        >
          <Trash2Icon className="size-5" />
        </Button>
      </DeleteEntityTrigger>
    </div>
  );
}
