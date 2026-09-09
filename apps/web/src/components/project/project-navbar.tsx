import {
  Navbar,
  TNavbarCommandPanelContext,
  NavbarBreadcrumb,
  NavbarTabsLg,
  NavbarTabsSm,
  NavbarTabsMd,
} from "@/components/navigation/navbar";
import ProjectBreadcrumb from "@/components/project/project-breadcrumb";
import { useProject } from "@/components/project/project-provider";
import ProjectTabs from "@/components/project/project-tabs";
import { useMemo } from "react";

type TProps = {
  className?: string;
};

export default function ProjectNavbar({ className }: TProps) {
  const { teamId, projectId } = useProject();
  const commandPanelContext: TNavbarCommandPanelContext = useMemo(
    () => ({ contextType: "project", teamId, projectId }),
    [teamId, projectId],
  );

  return (
    <Navbar commandPanelContext={commandPanelContext} className={className}>
      <NavbarBreadcrumb>
        <ProjectBreadcrumb />
      </NavbarBreadcrumb>
      <NavbarTabsLg>
        <ProjectTabs layoutId="project-tabs-lg" />
      </NavbarTabsLg>
      <NavbarTabsMd>
        <ProjectTabs layoutId="project-tabs-md" />
      </NavbarTabsMd>
      <NavbarTabsSm>
        <ProjectTabs layoutId="project-tabs-sm" />
      </NavbarTabsSm>
    </Navbar>
  );
}
