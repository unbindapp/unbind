import AccountTabs from "@/components/account/account-tabs";
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
import { useMemo } from "react";

export default function AccountNavbar() {
  const commandPanelContext: TNavbarCommandPanelContext = useMemo(
    () => ({ contextType: "account" }),
    [],
  );

  return (
    <Navbar commandPanelContext={commandPanelContext}>
      <NavbarBreadcrumb>
        <BreadcrumbWrapper>
          <BreadcrumbLink to="/account">Account</BreadcrumbLink>
        </BreadcrumbWrapper>
      </NavbarBreadcrumb>
      <NavbarTabsLg>
        <AccountTabs layoutId="account-tabs-lg" />
      </NavbarTabsLg>
      <NavbarTabsMd>
        <AccountTabs layoutId="account-tabs-md" />
      </NavbarTabsMd>
      <NavbarTabsSm>
        <AccountTabs layoutId="account-tabs-sm" />
      </NavbarTabsSm>
    </Navbar>
  );
}
