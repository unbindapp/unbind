"use client";

import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useTeams } from "@/components/team/teams-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

type TProps = {
  className?: string;
};

export default function TeamBreadcrumb({ className }: TProps) {
  const router = useRouter();
  const { teamId: teamIdFromPathname } = useIdsFromPathname();

  const { data: teamData, isPending } = useTeams();

  const [selectedTeamId, setSelectedTeamId] = useState(teamIdFromPathname);

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

  return (
    <BreadcrumbWrapper className={className}>
      <BreadcrumbItem
        flipChevronOnSm
        title="Teams"
        selectedItem={selectedTeam}
        items={teamData?.teams}
        onSelect={onTeamIdSelect}
        onIntent={onTeamIdIntent}
        newItemTitle="New Team"
        newItemIsPending={false}
        newItemComingSoon={true}
        onSelectNewItem={() => {}}
      />
    </BreadcrumbWrapper>
  );
}
