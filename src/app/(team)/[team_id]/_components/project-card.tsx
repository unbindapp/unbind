import ServiceIcon from "@/components/icons/service";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { groupByServiceGroup } from "@/lib/helpers";
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
  const groupedServices = groupByServiceGroup(defaultEnvironment.services);

  return (
    <li className={cn("w-full flex flex-col p-1", className)}>
      <LinkButton
        href={href}
        variant="ghost"
        className="w-full flex flex-col items-start text-left min-h-36 gap-12 border bg-background-hover rounded-xl px-5 py-3.5"
      >
        <h3 className="w-full font-bold leading-tight whitespace-nowrap overflow-hidden overflow-ellipsis">
          {project.title}
        </h3>
        <div className="w-full flex flex-col flex-1 justify-end">
          <div className="w-full flex items-center justify-between text-muted-foreground gap-3">
            <p className="shrink min-w-0 font-medium overflow-hidden overflow-ellipsis whitespace-nowrap text-sm">
              {defaultEnvironment.services.length > 0
                ? `${defaultEnvironment.services.length} services`
                : "No services"}
            </p>
            {groupedServices.length > 0 && (
              <div className="flex items-center gap-1 -mr-1">
                {groupedServices
                  .slice(0, iconLenght)
                  .map((g) =>
                    g.group ? (
                      <ServiceIcon
                        className="size-6"
                        key={g.group.id}
                        variant={g.group.type}
                      />
                    ) : (
                      g.services.map((s) => (
                        <ServiceIcon
                          className="size-6"
                          key={s.id}
                          variant={s.type}
                        />
                      ))
                    )
                  )}
                {groupedServices.length > iconLenght && (
                  <EllipsisIcon className="size-6" />
                )}
              </div>
            )}
          </div>
        </div>
      </LinkButton>
    </li>
  );
}
