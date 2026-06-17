import {
  Navbar,
  NavbarBreadcrumb,
  NavbarTabsLg,
  NavbarTabsMd,
  NavbarTabsSm,
} from "@/components/navigation/navbar";
import TeamBreadcrumb from "@/components/team/team-breadcrumb";
import TeamTabs from "@/components/team/team-tabs";

export default function TeamNavbar() {
  return (
    <Navbar>
      <NavbarBreadcrumb>
        <TeamBreadcrumb />
      </NavbarBreadcrumb>
      <NavbarTabsLg>
        <TeamTabs layoutId="team-tabs-lg" />
      </NavbarTabsLg>
      <NavbarTabsMd>
        <TeamTabs layoutId="team-tabs-md" />
      </NavbarTabsMd>
      <NavbarTabsSm>
        <TeamTabs layoutId="team-tabs-sm" />
      </NavbarTabsSm>
    </Navbar>
  );
}
