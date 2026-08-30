import { BreadcrumbSeparator } from "@/components/navigation/breadcrumb-wrapper";
import LogoLink from "@/components/navigation/logo-link";
import NavbarScrollArea from "@/components/navigation/navbar-scroll-area";
import UserAvatarOrSignIn from "@/components/navigation/user-avatar-or-sign-in";
import { hasChildRole, withChildRole } from "@/components/ui/child-role";
import { cn } from "@/components/ui/utils";
import { Children, ReactNode } from "react";

const NAVBAR_ROLE = {
  breadcrumb: "navbar.breadcrumb",
  tabsLg: "navbar.tabs-lg",
  tabsMd: "navbar.tabs-md",
  tabsSm: "navbar.tabs-sm",
} as const;

export function Navbar({ children, className }: { className?: string; children?: ReactNode }) {
  // Filter children by component type
  const childrenArray = Children.toArray(children);
  const breadcrumb = childrenArray.find((child) => hasChildRole(child, NAVBAR_ROLE.breadcrumb));
  const tabsLg = childrenArray.find((child) => hasChildRole(child, NAVBAR_ROLE.tabsLg));
  const tabsMd = childrenArray.find((child) => hasChildRole(child, NAVBAR_ROLE.tabsMd));
  const tabsSm = childrenArray.find((child) => hasChildRole(child, NAVBAR_ROLE.tabsSm));

  return (
    <nav
      className={cn(
        `bg-background fixed bottom-0 left-0 z-40 flex w-full flex-col items-stretch justify-between border-t pb-(--safe-area-inset-bottom) sm:sticky sm:top-0 sm:border-t-0 sm:border-b sm:pb-0`,
        className,
      )}
    >
      {tabsSm && (
        <div className="flex w-full border-b sm:hidden">
          <NavbarScrollArea>{tabsSm}</NavbarScrollArea>
        </div>
      )}
      <div className="flex w-full items-stretch justify-between gap-2 px-3">
        <div className="-ml-2 flex min-w-0 shrink items-stretch justify-start sm:-ml-1.5">
          <LogoLink />
          {breadcrumb && <BreadcrumbSeparator />}
          {(breadcrumb || tabsLg) && (
            <>
              {breadcrumb}
              {tabsLg && <BreadcrumbSeparator className="hidden lg:flex" />}
            </>
          )}
          {tabsLg && (
            <NavbarScrollArea className="hidden shrink-0 lg:flex">{tabsLg}</NavbarScrollArea>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end">
          <UserAvatarOrSignIn />
        </div>
      </div>
      {tabsMd && (
        <div className="hidden w-full border-t sm:flex lg:hidden">
          <NavbarScrollArea>{tabsMd}</NavbarScrollArea>
        </div>
      )}
    </nav>
  );
}

function NavbarBreadcrumb({ children }: { children: ReactNode }) {
  return children;
}
withChildRole(NavbarBreadcrumb, NAVBAR_ROLE.breadcrumb);

function NavbarTabsLg({ children }: { children: ReactNode }) {
  return children;
}
withChildRole(NavbarTabsLg, NAVBAR_ROLE.tabsLg);

function NavbarTabsMd({ children }: { children: ReactNode }) {
  return children;
}
withChildRole(NavbarTabsMd, NAVBAR_ROLE.tabsMd);

function NavbarTabsSm({ children }: { children: ReactNode }) {
  return children;
}
withChildRole(NavbarTabsSm, NAVBAR_ROLE.tabsSm);

export { NavbarBreadcrumb, NavbarTabsLg, NavbarTabsMd, NavbarTabsSm };
