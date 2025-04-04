import BrandIcon from "@/components/icons/brand";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { EllipsisIcon } from "lucide-react";

type TProps = {
  project: AppRouterOutputs["projects"]["list"]["projects"][number];
  className?: string;
};

const iconLength = 4;

export default function ProjectCard({ project, className }: TProps) {
  const environments = project.environments;
  const defaultEnvironment = environments.length >= 1 ? project.environments[0] : null;
  const serviceCount = defaultEnvironment?.service_count;
  const serviceIcons = defaultEnvironment?.framework_summary;

  if (!defaultEnvironment)
    return (
      <li className={cn("text-destructive flex w-full flex-col p-1", className)}>
        <div className="bg-destructive/10 border-destructive/10 min-h-36 rounded-xl border px-5 py-3.5 font-medium">
          {`Couldn't find default environment`}
        </div>
      </li>
    );
  const href = `${project.team_id}/project/${project.id}?environment=${defaultEnvironment.id}`;
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
          <div className="text-muted-foreground flex w-full items-center justify-between gap-3">
            <p className="min-w-0 shrink overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
              {serviceCount !== undefined && serviceCount > 0
                ? `${defaultEnvironment.service_count} service${serviceCount > 1 ? "s" : ""}`
                : "No services"}
            </p>
            {serviceIcons !== undefined && serviceIcons.length > 0 && (
              <div className="-my-2 -mr-1 flex items-center gap-1">
                {serviceIcons.slice(0, iconLength).map((s, index) => (
                  <BrandIcon brand={s} className="size-5" key={`${s}-${index}`} />
                ))}
                {serviceIcons.length > iconLength && <EllipsisIcon className="size-5" />}
              </div>
            )}
          </div>
        </div>
      </LinkButton>
    </li>
  );
}
