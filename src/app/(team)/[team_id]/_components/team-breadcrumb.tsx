"use client";

import {
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbWrapper,
} from "@/components/navigation/breadcrumb-item";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { api } from "@/server/trpc/setup/client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  className?: string;
};

export default function TeamBreadcrumb({ className }: Props) {
  const { asyncPush } = useAsyncPush();
  const pathname = usePathname();
  const pathnameArr = pathname.split("/");

  const teamIdFromPathname =
    pathnameArr.length > 1 ? pathnameArr[1] : undefined;
  const projectIdFromPathname =
    pathnameArr.length > 3 ? pathnameArr[3] : undefined;

  const { data: teamData } = api.main.getTeams.useQuery({});

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
      {!projectIdFromPathname && selectedTeam && (
        <>
          <BreadcrumbSeparator />
          <BreadcrumbItem
            selectedItem={selectedTeam}
            items={teamData?.teams}
            onSelect={onTeamIdSelect}
            /* IconItem={({ id }) => (
              <Blockies address={id} className="size-4 rounded-full" />
            )} */
            getHrefForId={getHrefForTeamId}
          />
        </>
      )}
    </BreadcrumbWrapper>
  );
}
