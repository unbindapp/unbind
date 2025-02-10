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
      <div className="w-full flex justify-between items-center px-3 py-1.5 border-b">
        <div className="shrink min-w-0 flex items-center justify-start -ml-0.5 gap-1">
          <LogoLink />
          <ProjectBreadcrumb />
        </div>
        <div className="shrink min-w-0 flex items-center justify-end">
          <Avatar />
        </div>
      </div>
      <ProjectTabs />
    </nav>
  );
}
