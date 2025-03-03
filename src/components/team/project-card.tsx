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
    <li className={cn("flex w-full flex-col p-1", className)}>
      <LinkButton
        href={href}
        variant="ghost"
        className="bg-background-hover flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border px-5 py-3.5 text-left"
      >
        <h3 className="w-full overflow-hidden leading-tight font-bold text-ellipsis whitespace-nowrap">
          {project.title}
        </h3>
        <div className="flex w-full flex-1 flex-col justify-end">
          <div className="text-muted-foreground flex w-full items-center justify-between gap-3">
            <p className="min-w-0 shrink overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
              {defaultEnvironment.services.length > 0
                ? `${defaultEnvironment.services.length} services`
                : "No services"}
            </p>
            {groupedServices.length > 0 && (
              <div className="-my-2 -mr-1 flex items-center gap-1">
                {groupedServices
                  .slice(0, iconLenght)
                  .map((g) =>
                    g.group ? (
                      <ServiceIcon className="size-5" key={g.group.id} variant={g.group.type} />
                    ) : (
                      g.services.map((s) => (
                        <ServiceIcon className="size-5" key={s.id} variant={s.type} />
                      ))
                    ),
                  )}
                {groupedServices.length > iconLenght && <EllipsisIcon className="size-5" />}
              </div>
            )}
          </div>
        </div>
      </LinkButton>
    </li>
  );
}
