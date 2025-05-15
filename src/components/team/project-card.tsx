import BrandIcon from "@/components/icons/brand";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { DeleteEntityTrigger } from "@/components/settings/delete-card";
import { Button, LinkButton, TButtonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TProjectShallow } from "@/server/trpc/api/projects/types";
import { api } from "@/server/trpc/setup/client";
import { ReactNode } from "react";

type TProps = {
  className?: string;
} & (
  | { project: TProjectShallow; isPlaceholder?: never }
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

  const href = !isPlaceholder
    ? !defaultEnvironment
      ? null
      : `${project.team_id}/project/${project.id}?environment=${defaultEnvironment.id}`
    : "";

  return (
    <li
      data-placeholder={isPlaceholder ? true : undefined}
      className={cn("group/item flex w-full flex-col p-1", className)}
    >
      <ConditionalButton
        project={project}
        href={href}
        variant="ghost"
        className="bg-background-hover flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border px-5 py-3.5 text-left"
      >
        <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton max-w-full overflow-hidden leading-tight font-bold text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {!isPlaceholder ? project.name : "Loading"}
        </h3>
        <div className="flex w-full flex-1 flex-col justify-end">
          <div className="text-muted-foreground flex w-full items-end justify-between gap-6">
            <div className="flex min-w-0 shrink flex-col gap-0.75 py-[0.09375rem] text-sm font-medium">
              <p className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
                {environmentCount !== undefined && environmentCount > 0
                  ? `${environmentCount} environment${environmentCount > 1 ? "s" : ""}`
                  : "No environments"}
              </p>
              <p className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton min-w-0 shrink truncate leading-tight group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
                {serviceCount !== undefined && serviceCount > 0
                  ? `${serviceCount} service${serviceCount > 1 ? "s" : ""}`
                  : "No services"}
              </p>
            </div>
            {serviceIcons !== undefined && serviceIcons.length > 0 && (
              <div className="-mr-1 flex max-w-2/3 shrink-0 items-center gap-1 overflow-hidden">
                {serviceIcons.slice(0, iconLength).map((s, index) => (
                  <BrandIcon
                    brand={s}
                    className="group-data-placeholder/item:bg-muted-foreground group-data-placeholder/item:animate-skeleton size-5 group-data-placeholder/item:rounded-full group-data-placeholder/item:text-transparent"
                    key={`${s}-${index}`}
                  />
                ))}
                {serviceIcons.length > iconLength && (
                  <p className="flex h-5 min-w-5 items-center justify-center overflow-hidden rounded-full text-center text-sm font-semibold">
                    +{serviceIcons.length - iconLength}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </ConditionalButton>
    </li>
  );
}

function ConditionalButton({
  href,
  variant,
  project,
  className,
  children,
}: {
  href: string | null;
  variant: TButtonVariants["variant"];
  project?: TProjectShallow;
  className: string;
  children: ReactNode;
}) {
  const { invalidate } = useProjectsUtils({ teamId: project?.team_id || "" });
  const {
    mutateAsync: deleteProject,
    error,
    reset,
  } = api.projects.delete.useMutation({
    onSuccess: () => {
      invalidate();
    },
  });
  const { asyncPush } = useAsyncPush();

  if (href === null) {
    return (
      <DeleteEntityTrigger
        type="project"
        description="This project doesn't have any environments, please delete it."
        deletingEntityName={project?.name || "Project"}
        onDialogClose={reset}
        onSubmit={async () => {
          if (!project) return;
          await deleteProject({ teamId: project.team_id, projectId: project.id });
          await asyncPush(`/${project.team_id}`);
        }}
        error={error}
      >
        <Button variant={variant} className={className}>
          {children}
        </Button>
      </DeleteEntityTrigger>
    );
  }

  return (
    <LinkButton href={href} variant={variant} className={className}>
      {children}
    </LinkButton>
  );
}
