import {
  Navbar,
  TNavbarCommandPanelContext,
  NavbarBreadcrumb,
  NavbarTabsLg,
  NavbarTabsMd,
  NavbarTabsSm,
} from "@/components/navigation/navbar";
import TeamBreadcrumb from "@/components/team/team-breadcrumb";
import { useTeam } from "@/components/team/team-provider";
import TeamTabs from "@/components/team/team-tabs";
import { useMemo } from "react";

export default function TeamNavbar() {
  const { teamId } = useTeam();
  const commandPanelContext: TNavbarCommandPanelContext = useMemo(
    () => ({ contextType: "team", teamId }),
    [teamId],
  );

  return (
    <Navbar commandPanelContext={commandPanelContext}>
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
