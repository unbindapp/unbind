import Avatar from "@/components/navigation/avatar";
import { BreadcrumbSeparator } from "@/components/navigation/breadcrumb-wrapper";
import LogoLink from "@/components/navigation/logo-link";
import { cn } from "@/components/ui/utils";
import { ReactNode, Children, isValidElement } from "react";

export async function Navbar({
  children,
  className,
}: {
  className?: string;
  children: ReactNode;
}) {
  // Filter children by component type
  const childrenArray = Children.toArray(children);
  const breadcrumb = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      hasDisplayName(child.type) &&
      child.type.displayName === "NavbarBreadcrumb"
  );
  const desktopTabs = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      hasDisplayName(child.type) &&
      child.type.displayName === "NavbarTabs"
  );
  const mobileTabs = childrenArray.find(
    (child) =>
      isValidElement(child) &&
      hasDisplayName(child.type) &&
      child.type.displayName === "NavbarTabsSm"
  );

  return (
    <nav
      className={cn(
        "w-full sticky top-0 left-0 z-50 bg-background flex flex-col items-stretch justify-between border-b",
        className
      )}
    >
      <div className="w-full flex justify-between items-stretch px-3 gap-5">
        <div className="shrink min-w-0 flex items-stretch justify-start -ml-0.5">
          <LogoLink />
          {breadcrumb && <BreadcrumbSeparator />}
          {(breadcrumb || desktopTabs) && (
            <div className="shrink min-h-full flex items-stretch justify-start min-w-0 overflow-auto">
              {breadcrumb}
              {desktopTabs && (
                <BreadcrumbSeparator className="hidden lg:flex" />
              )}
            </div>
          )}
          {desktopTabs && (
            <div className="shrink min-h-full items-stretch justify-start min-w-0 overflow-auto hidden lg:flex">
              {desktopTabs}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center justify-end">
          <Avatar />
        </div>
      </div>
      {mobileTabs && (
        <div className="w-full flex border-t lg:hidden">{mobileTabs}</div>
      )}
    </nav>
  );
}

function NavbarBreadcrumb({ children }: { children: ReactNode }) {
  return children;
}
NavbarBreadcrumb.displayName = "NavbarBreadcrumb";

function NavbarTabs({ children }: { children: ReactNode }) {
  return children;
}
NavbarTabs.displayName = "NavbarTabs";

function NavbarTabsSm({ children }: { children: ReactNode }) {
  return children;
}
NavbarTabsSm.displayName = "NavbarTabsSm";

function hasDisplayName(type: unknown): type is { displayName: string } {
  return typeof (type as { displayName: string })?.displayName === "string";
}

export { NavbarBreadcrumb, NavbarTabs, NavbarTabsSm };
