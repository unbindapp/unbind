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
        <ProjectTabs classNameInner="lg:px-0" />
      </NavbarTabsLg>
      <NavbarTabsMd>
        <ProjectTabs />
      </NavbarTabsMd>
      <NavbarTabsSm>
        <ProjectTabs />
      </NavbarTabsSm>
    </Navbar>
  );
}
