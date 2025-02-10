import TeamBreadcrumb from "@/app/(team)/[team_id]/_components/team-breadcrumb";
import Avatar from "@/components/navigation/avatar";
import LogoLink from "@/components/navigation/logo-link";
import { cn } from "@/components/ui/utils";

type Props = { className?: string };

export default async function TeamNavbar({ className }: Props) {
  return (
    <nav
      className={cn(
        "w-full sticky top-0 left-0 z-50 bg-background border-b flex flex-row items-center justify-between px-3 py-1.5",
        className
      )}
    >
      <div className="shrink min-w-0 flex items-center justify-start -ml-0.5 gap-1">
        <LogoLink />
        <TeamBreadcrumb />
      </div>
      <div className="shrink min-w-0 flex items-center justify-end">
        <Avatar />
      </div>
    </nav>
  );
}
