import { BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import {
  Navbar,
  NavbarBreadcrumb,
  NavbarTabsLg,
  NavbarTabsMd,
  NavbarTabsSm,
} from "@/components/navigation/navbar";
import SystemTabs from "@/components/system/system-tabs";

export default function SystemNavbar() {
  return (
    <Navbar>
      <NavbarBreadcrumb>
        <BreadcrumbWrapper>
          <div className="flex min-w-0 shrink items-center py-3.5 pr-1.5 pl-2.75 text-sm font-medium">
            <p className="min-w-0 shrink truncate py-0.5 leading-none">System</p>
          </div>
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
