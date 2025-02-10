import Avatar from "@/components/navigation/avatar";
import { BreadcrumbSeparator } from "@/components/navigation/breadcrumb-wrapper";
import LogoLink from "@/components/navigation/logo-link";
import ProjectBreadcrumb from "@/components/project/project-breadcrumb";
import ProjectTabs from "@/components/project/project-tabs";
import { cn } from "@/components/ui/utils";

type Props = { className?: string };

export default async function ProjectNavbar({ className }: Props) {
  return (
    <nav
      className={cn(
        "w-full sticky top-0 left-0 z-50 bg-background flex flex-col items-center justify-between",
        className
      )}
    >
      <div className="w-full flex justify-between items-stretch px-3 border-b gap-5">
        <div className="shrink min-w-0 flex items-center justify-start -ml-0.5">
          <div className="py-1 pr-1">
            <LogoLink />
          </div>
          <BreadcrumbSeparator />
          <div className="shrink min-h-full flex items-center justify-start min-w-0 overflow-auto">
            <ProjectBreadcrumb />
            <BreadcrumbSeparator className="hidden lg:block" />
          </div>
          <div className="shrink min-h-full items-stretch justify-start min-w-0 overflow-auto hidden lg:flex">
            <ProjectTabs
              classNameInner="px-0 sm:px-0"
              layoutId="project-tabs-lg"
            />
          </div>
        </div>
        <div className="shrink-0 flex items-center justify-end">
          <Avatar />
        </div>
      </div>
      <div className="w-full flex border-b lg:hidden">
        <ProjectTabs layoutId="project-tabs-sm" />
      </div>
    </nav>
  );
}
