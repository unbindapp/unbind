"use client";

import RoleSelect, { roleTitle } from "@/components/team/settings/members/role-select";
import {
  useTeamMembers,
  useTeamMembersUtils,
} from "@/components/team/settings/members/team-members-provider";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  removeTeamMember as removeTeamMemberFn,
  updateTeamMemberRole as updateTeamMemberRoleFn,
  type TTeamMember,
} from "@/lib/queries/teams";
import { useMutation } from "@tanstack/react-query";
import { Trash2Icon, UserIcon, UsersIcon } from "lucide-react";

type TProps =
  | { member: TTeamMember; isPlaceholder?: never }
  | { member?: never; isPlaceholder: true };

export default function MemberCard({ member, isPlaceholder }: TProps) {
  const { teamId, canManage } = useTeamMembers();
  const { invalidate } = useTeamMembersUtils();

  const { mutate: updateRole, isPending: isUpdatingRole } = useMutation({
    mutationFn: updateTeamMemberRoleFn,
    onSuccess: () => invalidate(),
    onError: (error) =>
      toast.add({ type: "error", title: "Failed to change role", description: error.message }),
  });

  const {
    mutateAsync: removeMember,
    error: removeError,
    reset: removeReset,
  } = useMutation({ mutationFn: removeTeamMemberFn, onSuccess: () => invalidate() });

  const inherited = member?.source === "group";
  const editable = canManage && member !== undefined && !inherited;

  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className="group/item flex w-full items-center justify-between gap-3 rounded-xl border p-3 sm:px-4"
    >
      <div className="flex min-w-0 shrink items-center gap-2 leading-tight">
        <div className="line-icon">
          {inherited ? (
            <UsersIcon className="text-muted-foreground size-4.5" />
          ) : (
            <UserIcon className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground size-4.5 group-data-placeholder/item:rounded-full" />
          )}
        </div>
        <div className="flex min-w-0 shrink flex-col gap-0.5">
          <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 truncate font-medium group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
            {member ? member.email : "member@example.com"}
          </p>
          {inherited && (
            <p className="text-muted-foreground min-w-0 truncate text-sm">
              {roleTitle(member.role)} via {member.group_name}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {editable ? (
          <>
            <RoleSelect
              value={member.role}
              isPending={isUpdatingRole}
              disabled={isUpdatingRole}
              onChange={(role) => {
                if (role === member.role) return;
                updateRole({ teamId, userId: member.id, role });
              }}
            />
            <DeleteEntityTrigger
              dialogTitle="Remove Member"
              dialogDescription="They lose access to this team right away. Their account stays."
              disableConfirmationInput
              submitButtonText="Remove"
              deletingEntityName={member.email}
              EntityNameBadge={() => (
                <p className="bg-foreground/2-10 border-foreground/2-10 -ml-0.5 max-w-[calc(100%+0.25rem)] truncate rounded-md border px-1.5 py-px text-sm font-medium">
                  {member.email}
                </p>
              )}
              onDialogClose={removeReset}
              error={removeError}
              onSubmit={async () => {
                await removeMember({ teamId, userId: member.id });
              }}
            >
              <Button
                aria-label="Remove member"
                variant="ghost"
                size="icon"
                className="text-muted-more-foreground has-hover:hover:text-destructive rounded-lg"
              >
                <Trash2Icon className="size-5" />
              </Button>
            </DeleteEntityTrigger>
          </>
        ) : (
          !inherited && (
            <p className="text-muted-foreground group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground px-1 text-sm group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
              {member ? roleTitle(member.role) : "Viewer"}
            </p>
          )
        )}
      </div>
    </div>
  );
}
