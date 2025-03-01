import { BreadcrumbSeparator } from "@/components/navigation/breadcrumb-wrapper";
import LogoLink from "@/components/navigation/logo-link";
import UserAvatarOrSignIn from "@/components/navigation/user-avatar-or-sign-in";
import { cn } from "@/components/ui/utils";
import { auth } from "@/server/auth/auth";
import { Children, isValidElement, ReactNode } from "react";

export async function Navbar({
  children,
  className,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const session = await auth();

  // Filter children by component type
  const childrenArray = Children.toArray(children);
  const breadcrumb = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "function" &&
      child.type === NavbarBreadcrumb
  );
  const tabsLg = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "function" &&
      child.type === NavbarTabsLg
  );
  const tabsMd = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "function" &&
      child.type === NavbarTabsMd
  );
  const tabsSm = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      typeof child.type === "function" &&
      child.type === NavbarTabsSm
  );

  return (
    <nav
      className={cn(
        `w-full fixed bottom-0 left-0 sm:sticky sm:top-0 z-50 bg-background flex flex-col items-stretch justify-between border-t sm:border-t-0 sm:border-b
        pb-[var(--safe-area-inset-bottom)] sm:pb-0`,
        className
      )}
    >
      {tabsSm && <div className="w-full flex border-b sm:hidden">{tabsSm}</div>}
      <div className="w-full flex justify-between items-stretch px-3 gap-5">
        <div className="shrink min-w-0 flex items-stretch justify-start -ml-2 sm:-ml-1.5">
          <LogoLink />
          {breadcrumb && <BreadcrumbSeparator />}
          {(breadcrumb || tabsLg) && (
            <div className="shrink min-h-full flex items-stretch justify-start min-w-0 overflow-auto">
              {breadcrumb}
              {tabsLg && <BreadcrumbSeparator className="hidden lg:flex" />}
            </div>
          )}
          {tabsLg && (
            <div className="shrink min-h-full items-stretch justify-start min-w-0 overflow-auto hidden lg:flex">
              {tabsLg}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center justify-end">
          <UserAvatarOrSignIn session={session} />
        </div>
      </div>
      {tabsMd && (
        <div className="w-full border-t hidden sm:flex lg:hidden">{tabsMd}</div>
      )}
    </nav>
  );
}

function NavbarBreadcrumb({ children }: { children: ReactNode }) {
  return children;
}

function NavbarTabsLg({ children }: { children: ReactNode }) {
  return children;
}

function NavbarTabsMd({ children }: { children: ReactNode }) {
  return children;
}

function NavbarTabsSm({ children }: { children: ReactNode }) {
  return children;
}

export { NavbarBreadcrumb, NavbarTabsLg, NavbarTabsMd, NavbarTabsSm };
