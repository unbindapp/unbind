import ContextCommandPanel from "@/components/command-panel/context-command-panel/context-command-panel";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import SystemProvider from "@/components/system/system-provider";
import TeamNavbar from "@/components/team/team-navbar";
import TeamProvider from "@/components/team/team-provider";
import TeamsProvider from "@/components/team/teams-provider";
import TemplatesProvider from "@/components/templates/templates-provider";
import CheckForUpdatesProvider, {
  UpdateToastProvider,
} from "@/components/update/check-for-updates-provider";
import { apiServer } from "@/server/trpc/setup/server";
import { ResultAsync } from "neverthrow";
import { notFound, redirect } from "next/navigation";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  params: Promise<{ team_id: string }>;
};

export default async function Layout({ children, params }: TProps) {
  const { team_id: teamId } = await params;

  const [teamInitialData, teamsInitialData, templatesData, systemData] = await Promise.all([
    ResultAsync.fromPromise(
      apiServer.teams.get({ teamId }),
      () => new Error("Failed to fetch team"),
    ),
    ResultAsync.fromPromise(apiServer.teams.list(), () => new Error("Failed to fetch teams")),
    ResultAsync.fromPromise(
      apiServer.templates.list(),
      () => new Error("Failed to fetch templates"),
    ),
    ResultAsync.fromPromise(apiServer.system.get(), () => new Error("Failed to fetch system")),
  ]);

  if (teamsInitialData.isErr()) {
    return notFound();
  }

  if (teamInitialData.isErr()) {
    if (teamsInitialData.value.teams.length >= 1) {
      return redirect(`/${teamsInitialData.value.teams[0].id}`);
    }
    return notFound();
  }

  if (templatesData.isErr()) {
    return notFound();
  }

  if (systemData.isErr()) {
    return notFound();
  }

  return (
    <SystemProvider initialData={systemData.value}>
      <TemplatesProvider data={templatesData.value}>
        <UpdateToastProvider>
          <TeamsProvider initialData={teamsInitialData.value}>
            <TeamProvider initialData={teamInitialData.value} teamId={teamId}>
              <TeamNavbar />
              {children}
              <NavbarSafeAreaInsetBottom className="sm:hidden" />
              <ContextCommandPanel
                title="Team Command Panel"
                description="Team command panel"
                context={{ contextType: "team", teamId }}
                triggerType="layout"
              />
            </TeamProvider>
          </TeamsProvider>
        </UpdateToastProvider>
      </TemplatesProvider>
    </SystemProvider>
  );
}
