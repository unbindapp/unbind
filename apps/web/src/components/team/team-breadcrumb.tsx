"use client";

import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { CreateTeamDialog } from "@/components/team/create-team-dialog";
import TeamIcon from "@/components/team/team-icon";
import { useTeams } from "@/components/team/teams-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { isSystemAdmin, meQuery } from "@/lib/queries/me";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { ReactElement, useCallback, useEffect, useState } from "react";

type TProps = {
  className?: string;
};

export default function TeamBreadcrumb({ className }: TProps) {
  const router = useRouter();
  const { teamId: teamIdFromPathname } = useIdsFromPathname();

  const { data: teamData, isPending } = useTeams();
  const { data: me } = useQuery(meQuery);
  const canCreateTeam = isSystemAdmin(me);

  const [selectedTeamId, setSelectedTeamId] = useState(teamIdFromPathname);
  const [isTeamsMenuOpen, setIsTeamsMenuOpen] = useState(false);

  useEffect(() => {
    setSelectedTeamId(teamIdFromPathname);
  }, [teamIdFromPathname, teamData]);

  const selectedTeam =
    selectedTeamId && !isPending
      ? teamData?.teams.find((t) => t.id === selectedTeamId) || null
      : undefined;

  const onTeamIdSelect = useCallback(
    async (id: string) => {
      setSelectedTeamId(id);
      await router.navigate({ to: "/$team_id", params: { team_id: id } });
    },
    [router],
  );

  const onTeamIdIntent = useCallback(
    (id: string) => {
      void router.preloadRoute({ to: "/$team_id", params: { team_id: id } });
    },
    [router],
  );

  const teams = teamData?.teams;
  const TeamIconItem = useCallback(
    ({ id, className }: { id: string; className?: string }) => {
      const team = teams?.find((t) => t.id === id);
      if (!team) return null;
      return <TeamIcon team={team} className={className} />;
    },
    [teams],
  );

  const CreateTeamDialogMemoized = useCallback(
    ({ children }: { children: ReactElement }) => (
      <CreateTeamDialog
        dialogOnOpenChange={(o) => {
          if (!o) setIsTeamsMenuOpen(false);
        }}
      >
        {children}
      </CreateTeamDialog>
    ),
    [],
  );

  const shared = {
    chevron: "up-down" as const,
    IconItem: TeamIconItem,
    title: "Teams",
    selectedItem: selectedTeam,
    items: teamData?.teams,
    onSelect: onTeamIdSelect,
    onIntent: onTeamIdIntent,
  };

  return (
    <BreadcrumbWrapper className={className}>
      {canCreateTeam ? (
        <BreadcrumbItem
          {...shared}
          open={isTeamsMenuOpen}
          setOpen={setIsTeamsMenuOpen}
          newItemTitle="New Team"
          newItemIsPending={false}
          newItemDontCloseMenuOnSelect={true}
          NewItemWrapper={CreateTeamDialogMemoized}
          onSelectNewItem={() => {}}
        />
      ) : (
        <BreadcrumbItem {...shared} />
      )}
    </BreadcrumbWrapper>
  );
}
