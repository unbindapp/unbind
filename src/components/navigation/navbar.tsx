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
      isValidElement(child) && typeof child.type === "function" && child.type === NavbarBreadcrumb,
  );
  const tabsLg = childrenArray.find(
    (child) =>
      isValidElement(child) && typeof child.type === "function" && child.type === NavbarTabsLg,
  );
  const tabsMd = childrenArray.find(
    (child) =>
      isValidElement(child) && typeof child.type === "function" && child.type === NavbarTabsMd,
  );
  const tabsSm = childrenArray.find(
    (child) =>
      isValidElement(child) && typeof child.type === "function" && child.type === NavbarTabsSm,
  );

  return (
    <nav
      className={cn(
        `bg-background fixed bottom-0 left-0 z-50 flex w-full flex-col items-stretch justify-between border-t pb-[var(--safe-area-inset-bottom)] sm:sticky sm:top-0 sm:border-t-0 sm:border-b sm:pb-0`,
        className,
      )}
    >
      {tabsSm && <div className="flex w-full border-b sm:hidden">{tabsSm}</div>}
      <div className="flex w-full items-stretch justify-between gap-5 px-3">
        <div className="-ml-2 flex min-w-0 shrink items-stretch justify-start sm:-ml-1.5">
          <LogoLink />
          {breadcrumb && <BreadcrumbSeparator />}
          {(breadcrumb || tabsLg) && (
            <div className="flex min-h-full min-w-0 shrink items-stretch justify-start overflow-auto">
              {breadcrumb}
              {tabsLg && <BreadcrumbSeparator className="hidden lg:flex" />}
            </div>
          )}
          {tabsLg && (
            <div className="hidden min-h-full min-w-0 shrink items-stretch justify-start overflow-auto lg:flex">
              {tabsLg}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end">
          <UserAvatarOrSignIn session={session} />
        </div>
      </div>
      {tabsMd && <div className="hidden w-full border-t sm:flex lg:hidden">{tabsMd}</div>}
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
