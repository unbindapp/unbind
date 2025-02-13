import {
  Navbar,
  NavbarBreadcrumb,
  NavbarTabs,
  NavbarTabsSm,
} from "@/components/navigation/navbar";
import ProjectBreadcrumb from "@/components/project/project-breadcrumb";
import ProjectTabs from "@/components/project/project-tabs";

export default async function ProjectNavbar() {
  return (
    <Navbar>
      <NavbarBreadcrumb>
        <ProjectBreadcrumb />
      </NavbarBreadcrumb>
      <NavbarTabs>
        <ProjectTabs classNameInner="px-0 sm:px-0" layoutId="project-tabs-lg" />
      </NavbarTabs>
      <NavbarTabsSm>
        <ProjectTabs layoutId="project-tabs-sm" />
      </NavbarTabsSm>
    </Navbar>
  );
}
