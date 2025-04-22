import BrandIcon from "@/components/icons/brand";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { EllipsisIcon } from "lucide-react";

type TProps = {
  className?: string;
} & (
  | { project: AppRouterOutputs["projects"]["list"]["projects"][number]; isPlaceholder?: never }
  | { project?: never; isPlaceholder: true }
);

const iconLength = 4;

export default function ProjectCard({ project, isPlaceholder, className }: TProps) {
  const environments = !isPlaceholder ? project.environments : [];
  const defaultEnvironment = !isPlaceholder
    ? environments.length >= 1
      ? project.default_environment_id
        ? environments.find((e) => e.id === project.default_environment_id)
        : project.environments[0]
      : null
    : undefined;

  const serviceCount = !isPlaceholder ? project.service_count : 1;
  const serviceIcons = !isPlaceholder ? project.service_icons : [];

  const environmentCount = !isPlaceholder ? environments.length : 1;

  if (!isPlaceholder && !defaultEnvironment)
    return (
      <li className={cn("text-destructive flex w-full flex-col p-1", className)}>
        <div className="bg-destructive/10 border-destructive/10 min-h-36 rounded-xl border px-5 py-3.5 font-medium">
          {`Couldn't find default environment`}
        </div>
      </li>
    );

  const href =
    !isPlaceholder && defaultEnvironment
      ? `${project.team_id}/project/${project.id}?environment=${defaultEnvironment.id}`
      : "";

  return (
    <li
      data-placeholder={isPlaceholder ? true : undefined}
      className={cn("group/item flex w-full flex-col p-1", className)}
    >
      <LinkButton
        href={href}
        variant="ghost"
        className="bg-background-hover flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border px-5 py-3.5 text-left"
      >
        <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton max-w-full overflow-hidden leading-tight font-bold text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {!isPlaceholder ? project.name : "Loading"}
        </h3>
        <div className="flex w-full flex-1 flex-col justify-end">
          <div className="text-muted-foreground flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 shrink flex-col">
              <p className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
                {serviceCount !== undefined && serviceCount > 0
                  ? `${serviceCount} service${serviceCount > 1 ? "s" : ""}`
                  : "No services"}
                <span className="text-muted-more-foreground px-[0.4ch] group-data-placeholder/item:text-transparent">
                  {" "}
                  |{" "}
                </span>
                {environmentCount !== undefined && environmentCount > 0
                  ? `${environmentCount} environment${environmentCount > 1 ? "s" : ""}`
                  : "No environments"}
              </p>
            </div>
            {serviceIcons !== undefined && serviceIcons.length > 0 && (
              <div className="-my-2 -mr-1 flex items-center gap-1">
                {serviceIcons.slice(0, iconLength).map((s, index) => (
                  <BrandIcon
                    brand={s}
                    className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton size-5 group-data-placeholder/item:rounded-full group-data-placeholder/item:text-transparent"
                    key={`${s}-${index}`}
                  />
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
