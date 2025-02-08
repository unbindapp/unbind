import ServiceIcon from "@/components/icons/service";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TProject } from "@/server/trpc/api/main/router";
import { EllipsisIcon } from "lucide-react";

type Props = {
  project: TProject;
  className?: string;
};

const iconLenght = 4;

export default function ProjectCard({ project, className }: Props) {
  const defaultEnvironment = project.environments[0];
  const href = `${project.teamId}/project/${project.id}/environment/${defaultEnvironment.id}`;
  return (
    <div className={cn("w-full flex flex-col p-1", className)}>
      <LinkButton
        href={href}
        variant="ghost"
        className="w-full flex flex-col items-start text-left gap-20 border bg-background-hover rounded-xl px-5 py-3.5"
      >
        <h3 className="w-full font-bold leading-tight whitespace-nowrap overflow-hidden overflow-ellipsis">
          {project.title}
        </h3>
        <div className="w-full flex items-center justify-between text-muted-foreground">
          <p className="shrink min-w-0 font-medium overflow-hidden overflow-ellipsis whitespace-nowrap text-sm">
            {defaultEnvironment.services.length > 0
              ? `${defaultEnvironment.services.length} services`
              : "No services"}
          </p>
          {defaultEnvironment.services.length > 0 && (
            <div className="min-w-0 shrink flex items-center gap-1 -mr-1">
              {defaultEnvironment.services.slice(0, iconLenght).map((s) => (
                <ServiceIcon
                  className="size-6"
                  key={s.id}
                  variant={s.serviceType}
                />
              ))}
              {defaultEnvironment.services.length > iconLenght && (
                <EllipsisIcon className="size-6" />
              )}
            </div>
          )}
        </div>
      </LinkButton>
    </div>
  );
}
