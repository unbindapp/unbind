import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { ReactNode } from "react";

import { teamsListQuery } from "@/lib/queries/teams";
import NotFoundTemplate from "@/components/navigation/not-found-template";

// A team the user isn't in (deleted, or removed from) goes to their first team, or 404s if they have none.
export default function TeamGuard({ teamId, children }: { teamId: string; children: ReactNode }) {
  const { data } = useQuery(teamsListQuery());

  if (!data || data.teams.some((t) => t.id === teamId)) return children;

  const firstTeam = data.teams[0];
  if (firstTeam) {
    return <Navigate to="/$team_id" params={{ team_id: firstTeam.id }} replace />;
  }

  return (
    <NotFoundTemplate
      code={404}
      description="Team not found."
      buttonText="Go Home"
      buttonTo="/"
      Icon={TriangleAlertIcon}
    />
  );
}
