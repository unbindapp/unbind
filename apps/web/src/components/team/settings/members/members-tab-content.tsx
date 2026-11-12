"use client";

import ErrorCard from "@/components/error-card";
import NoItemsCard from "@/components/no-items-card";
import SettingsTabTitle from "@/components/settings/settings-tab-title";
import InvitationCard from "@/components/team/settings/members/invitation-card";
import InviteMemberDialog from "@/components/team/settings/members/invite-member-dialog";
import MemberCard from "@/components/team/settings/members/member-card";
import {
  TeamMembersProvider,
  useTeamMembers,
} from "@/components/team/settings/members/team-members-provider";
import { useProject } from "@/components/project/project-provider";
import { useTeam } from "@/components/team/team-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { MailIcon, PlusIcon, UsersIcon } from "lucide-react";

const placeholderArray = Array.from({ length: 3 }, (_, i) => i);

export default function MembersTabContent({ className }: { className?: string }) {
  const {
    teamId,
    query: { data },
  } = useTeam();
  return (
    <TeamMembersProvider
      teamId={teamId}
      canManage={data?.team.permissions.includes("admin") ?? false}
    >
      <Content className={className} />
    </TeamMembersProvider>
  );
}

export function ProjectMembersTabContent({ className }: { className?: string }) {
  const {
    teamId,
    projectId,
    query: { data },
  } = useProject();
  return (
    <TeamMembersProvider
      teamId={teamId}
      projectId={projectId}
      canManage={data?.project.permissions.includes("admin") ?? false}
    >
      <Content className={className} />
    </TeamMembersProvider>
  );
}

function Content({ className }: { className?: string }) {
  const { projectId, canManage, members, invitations } = useTeamMembers();

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <SettingsTabTitle className="w-auto">
          {projectId ? "Project Members" : "Team Members"}
        </SettingsTabTitle>
        {canManage && (
          <InviteMemberDialog>
            <Button size="sm" className="gap-1.5">
              <PlusIcon className="-ml-1 size-4.5" />
              Invite
            </Button>
          </InviteMemberDialog>
        )}
      </div>
      <p className="text-muted-foreground mt-1.5 w-full px-1 leading-tight">
        {projectId
          ? "Everyone who can open this project, with their role. Team members can open every project of the team."
          : "Everyone who can open this team, with their role."}
      </p>
      <div className="mt-3 flex w-full flex-col gap-2">
        {members.error && !members.data && <ErrorCard message={members.error.message} />}
        {members.isPending &&
          !members.data &&
          placeholderArray.map((i) => <MemberCard key={i} isPlaceholder />)}
        {members.data?.members.length === 0 && (
          <NoItemsCard Icon={UsersIcon}>
            {projectId ? "No one is on this project yet" : "No one is on this team yet"}
          </NoItemsCard>
        )}
        {members.data?.members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>
      {canManage && (
        <>
          <SettingsTabTitle className="mt-8">Pending Invitations</SettingsTabTitle>
          <div className="mt-3 flex w-full flex-col gap-2">
            {invitations.error && !invitations.data && (
              <ErrorCard message={invitations.error.message} />
            )}
            {invitations.data?.invitations.length === 0 && (
              <NoItemsCard Icon={MailIcon}>No pending invitations</NoItemsCard>
            )}
            {invitations.data?.invitations.map((invitation) => (
              <InvitationCard key={invitation.id} invitation={invitation} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
