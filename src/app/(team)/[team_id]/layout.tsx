import ContextAwareCommandPanel from "@/components/command-panel/context-aware-command-panel/context-aware-command-panel";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import TeamNavbar from "@/components/team/team-navbar";
import TeamsProvider from "@/components/team/teams-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  params: Promise<{ team_id: string }>;
};

export default async function Layout({ children, params }: TProps) {
  const { team_id: teamId } = await params;

  const [teamsInitialData] = await Promise.all([apiServer.teams.list()]);
  return (
    <TeamsProvider initialData={teamsInitialData}>
      <TeamNavbar />
      {children}
      <NavbarSafeAreaInsetBottom className="sm:hidden" />
      <ContextAwareCommandPanel context={{ contextType: "team", teamId }} />
    </TeamsProvider>
  );
}
