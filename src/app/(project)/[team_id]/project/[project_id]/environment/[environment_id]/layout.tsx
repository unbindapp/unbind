import ProjectProvider from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/_components/project-provider";
import ContextAwareCommandPanel from "@/components/command-panel/context-aware-command-panel/context-aware-command-panel";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import ProjectNavbar from "@/components/project/project-navbar";
import { apiServer, HydrateClient } from "@/server/trpc/setup/server";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  params: Promise<{ team_id: string; project_id: string; environment_id: string }>;
};

export default async function Layout({ children, params }: TProps) {
  const { team_id: teamId, project_id: projectId, environment_id: environmentId } = await params;

  const initialData = await apiServer.projects.get({
    teamId,
    projectId,
  });

  return (
    <HydrateClient>
      <ProjectProvider initialData={initialData} teamId={teamId} projectId={projectId}>
        <ProjectNavbar />
        {children}
        <NavbarSafeAreaInsetBottom className="sm:hidden" />
        <ContextAwareCommandPanel
          context={{
            contextType: "project",
            projectId,
            environmentId,
            teamId,
          }}
        />
      </ProjectProvider>
    </HydrateClient>
  );
}
