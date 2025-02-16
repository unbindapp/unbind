import {
  Navbar,
  NavbarBreadcrumb,
  NavbarTabsLg,
  NavbarTabsSm,
  NavbarTabsMd,
} from "@/components/navigation/navbar";
import ProjectBreadcrumb from "@/components/project/project-breadcrumb";
import ProjectTabs from "@/components/project/project-tabs";

type Props = {
  className?: string;
};

export default async function ProjectNavbar({ className }: Props) {
  return (
    <Navbar className={className}>
      <NavbarBreadcrumb>
        <ProjectBreadcrumb />
      </NavbarBreadcrumb>
      <NavbarTabsLg>
        <ProjectTabs classNameInner="lg:px-0" layoutId="project-tabs-lg" />
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
