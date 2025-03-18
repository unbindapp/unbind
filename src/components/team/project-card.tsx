import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { AppRouterOutputs } from "@/server/trpc/api/root";

type TProps = {
  project: AppRouterOutputs["projects"]["list"]["projects"][number];
  className?: string;
};

/* const iconLenght = 4; */

export default function ProjectCard({ project, className }: TProps) {
  const environments = project.environments;
  const defaultEnvironment = environments.length >= 1 ? project.environments[0] : null;
  if (!defaultEnvironment)
    return (
      <li className={cn("text-destructive flex w-full flex-col p-1", className)}>
        <div className="bg-destructive/10 border-destructive/10 min-h-36 rounded-xl border px-5 py-3.5 font-medium">
          {`Couldn't find default environment`}
        </div>
      </li>
    );
  const href = `${project.team_id}/project/${project.id}/environment/${defaultEnvironment.id}`;
  /* const groupedServices = groupByServiceGroup(defaultEnvironment.services); */

  return (
    <li className={cn("flex w-full flex-col p-1", className)}>
      <LinkButton
        href={href}
        variant="ghost"
        className="bg-background-hover flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border px-5 py-3.5 text-left"
      >
        <h3 className="w-full overflow-hidden leading-tight font-bold text-ellipsis whitespace-nowrap">
          {project.display_name}
        </h3>
        <div className="flex w-full flex-1 flex-col justify-end">
          {/* <div className="text-muted-foreground flex w-full items-center justify-between gap-3">
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
          </div> */}
        </div>
      </LinkButton>
    </li>
  );
}
