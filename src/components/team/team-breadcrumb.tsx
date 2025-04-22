"use client";

import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useTeams } from "@/components/team/teams-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type TProps = {
  className?: string;
};

export default function TeamBreadcrumb({ className }: TProps) {
  const { asyncPush } = useAsyncPush();
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

  const getHrefForTeamId = useCallback(
    (id: string) => {
      const team = teamData?.teams.find((t) => t.id === id);
      if (!team) return null;
      return `/${team.id}`;
    },
    [teamData],
  );

  const onTeamIdSelect = useCallback(
    async (id: string) => {
      setSelectedTeamId(id);
      const href = getHrefForTeamId(id);
      if (!href) return;
      await asyncPush(href);
    },
    [asyncPush, getHrefForTeamId],
  );

  const onTeamIdHover = useCallback(
    (id: string) => {
      const href = getHrefForTeamId(id);
      if (!href) return;
      router.prefetch(href);
    },
    [getHrefForTeamId, router],
  );

  return (
    <BreadcrumbWrapper className={className}>
      <BreadcrumbItem
        flipChevronOnSm
        title="Teams"
        selectedItem={selectedTeam}
        items={teamData?.teams}
        onSelect={onTeamIdSelect}
        onHover={onTeamIdHover}
        newItemTitle="New Team"
        newItemIsPending={false}
        onSelectNewItem={() =>
          toast.success("New team created", {
            description: "This is fake.",
            duration: 3000,
            closeButton: false,
          })
        }
      />
    </BreadcrumbWrapper>
  );
}
