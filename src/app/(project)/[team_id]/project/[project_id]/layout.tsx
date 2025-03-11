import ContextAwareCommandPanel from "@/components/command-panel/context-aware-command-panel/context-aware-command-panel";
import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import ProjectNavbar from "@/components/project/project-navbar";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  params: Promise<{ team_id: string; project_id: string }>;
};

export default async function Layout({ children, params }: TProps) {
  const { team_id, project_id } = await params;
  return (
    <>
      <ProjectNavbar />
      {children}
      <NavbarSafeAreaInsetBottom className="sm:hidden" />
      <ContextAwareCommandPanel
        context={{ contextType: "project", projectId: project_id, teamId: team_id }}
      />
    </>
  );
}
