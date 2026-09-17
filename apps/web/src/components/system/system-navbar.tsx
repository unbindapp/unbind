import { BreadcrumbLink } from "@/components/navigation/breadcrumb-link";
import { BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import {
  Navbar,
  NavbarBreadcrumb,
  NavbarTabsLg,
  NavbarTabsMd,
  NavbarTabsSm,
  TNavbarCommandPanelContext,
} from "@/components/navigation/navbar";
import SystemTabs from "@/components/system/system-tabs";
import { useMemo } from "react";

export default function SystemNavbar() {
  const commandPanelContext: TNavbarCommandPanelContext = useMemo(
    () => ({ contextType: "system" }),
    [],
  );

  return (
    <Navbar commandPanelContext={commandPanelContext}>
      <NavbarBreadcrumb>
        <BreadcrumbWrapper>
          <BreadcrumbLink to="/system">System</BreadcrumbLink>
        </BreadcrumbWrapper>
      </NavbarBreadcrumb>
      <NavbarTabsLg>
        <SystemTabs layoutId="system-tabs-lg" />
      </NavbarTabsLg>
      <NavbarTabsMd>
        <SystemTabs layoutId="system-tabs-md" />
      </NavbarTabsMd>
      <NavbarTabsSm>
        <SystemTabs layoutId="system-tabs-sm" />
      </NavbarTabsSm>
    </Navbar>
  );
}
