import AccountTabs from "@/components/account/account-tabs";
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
          <div className="flex min-w-0 shrink items-center py-3.5 pr-1.5 pl-2.75 text-sm font-medium">
            <p className="min-w-0 shrink truncate py-0.5 leading-none">Account</p>
          </div>
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
