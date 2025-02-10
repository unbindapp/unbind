import ProjectBreadcrumb from "@/app/(project)/[team_id]/project/[project_id]/_components/project-breadcrumb";
import ProjectTabs from "@/app/(project)/[team_id]/project/[project_id]/_components/project-tabs";
import Avatar from "@/components/navigation/avatar";
import LogoLink from "@/components/navigation/logo-link";
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
      <div className="w-full flex justify-between items-stretch px-3 border-b gap-3">
        <div className="shrink min-w-0 flex items-center justify-start -ml-0.5 gap-1">
          <div className="py-1">
            <LogoLink />
          </div>
          <div className="shrink min-h-full flex items-center min-w-0 overflow-auto">
            <ProjectBreadcrumb />
          </div>
        </div>
        <div className="shrink-0 flex items-center justify-end">
          <Avatar />
        </div>
      </div>
      <div className="w-full flex border-b">
        <ProjectTabs layoutId="project-tabs" />
      </div>
    </nav>
  );
}
