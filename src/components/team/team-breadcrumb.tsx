"use client";

import { BreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { api } from "@/server/trpc/setup/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type TProps = {
  className?: string;
};

export default function TeamBreadcrumb({ className }: TProps) {
  const { asyncPush } = useAsyncPush();
  const { teamId: teamIdFromPathname } = useIdsFromPathname();

  const { data: teamData } = api.teams.list.useQuery();

  const [selectedTeamId, setSelectedTeamId] = useState(teamIdFromPathname);

  useEffect(() => {
    setSelectedTeamId(teamIdFromPathname);
  }, [teamIdFromPathname, teamData]);

  const selectedTeam = selectedTeamId
    ? teamData?.teams.find((t) => t.id === selectedTeamId)
    : undefined;

  async function onTeamIdSelect(id: string) {
    setSelectedTeamId(id);
    const href = getHrefForTeamId(id);
    if (!href) return;
    await asyncPush(href);
  }

  function getHrefForTeamId(id: string) {
    const team = teamData?.teams.find((t) => t.id === id);
    if (!team) return null;
    return `/${team.id}`;
  }

  return (
    <BreadcrumbWrapper className={className}>
      <BreadcrumbItem
        flipChevronOnSm
        title="Teams"
        selectedItem={selectedTeam}
        items={teamData?.teams}
        onSelect={onTeamIdSelect}
        newItemTitle="New Team"
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
