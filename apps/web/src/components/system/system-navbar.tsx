import { BreadcrumbWrapper } from "@/components/navigation/breadcrumb-wrapper";
import {
  Navbar,
  NavbarBreadcrumb,
  NavbarTabsLg,
  NavbarTabsMd,
  NavbarTabsSm,
} from "@/components/navigation/navbar";
import SystemTabs from "@/components/system/system-tabs";
import { ServerCogIcon } from "lucide-react";

export default function SystemNavbar() {
  return (
    <Navbar>
      <NavbarBreadcrumb>
        <BreadcrumbWrapper>
          <div className="flex min-w-0 shrink items-center gap-1.5 px-2 py-2.5 font-medium">
            <ServerCogIcon className="-ml-0.5 size-4.5 shrink-0" />
            <p className="min-w-0 shrink truncate leading-tight">System</p>
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
