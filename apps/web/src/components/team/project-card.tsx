import BrandIcon from "@/components/icons/brand";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { useProjectsUtils } from "@/components/project/projects-provider";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button, LinkButton, TButtonVariants } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { deleteProject as deleteProjectFn, type TProjectShallow } from "@/lib/queries/projects";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
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

  // undefined = placeholder (no navigation), null = real project missing a
  // default environment (delete trigger instead), object = typed navigation.
  const linkProps = isPlaceholder
    ? undefined
    : !defaultEnvironment
      ? null
      : ({
          to: "/$team_id/project/$project_id",
          params: { team_id: project.team_id, project_id: project.id },
          search: { environment: defaultEnvironment.id },
        } as const);

  return (
    <li
      data-placeholder={isPlaceholder ? true : undefined}
      className={cn("group/item flex w-full flex-col p-1", className)}
    >
      <ConditionalButton
        project={project}
        linkProps={linkProps}
        variant="ghost"
        className="bg-background-hover flex min-h-36 w-full flex-col items-start gap-12 rounded-xl border px-5 py-3.5 text-left font-semibold"
      >
        {project && <NewEntityIndicator id={project.id} />}
        <h3 className="group-data-placeholder/item:bg-foreground group-data-placeholder/item:animate-skeleton max-w-full overflow-hidden leading-tight text-ellipsis whitespace-nowrap group-data-placeholder/item:rounded-md group-data-placeholder/item:text-transparent">
          {!isPlaceholder ? project.name : "Loading"}
        </h3>
        <div className="flex w-full flex-1 flex-col justify-end">
          <div className="text-muted-foreground flex w-full items-end justify-between gap-6">
            <div className="py-0.375 flex min-w-0 shrink flex-col gap-0.75 text-sm font-medium">
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

type TCardLinkProps = {
  to: "/$team_id/project/$project_id";
  params: { team_id: string; project_id: string };
  search: { environment: string };
};

function ConditionalButton({
  linkProps,
  variant,
  project,
  className,
  children,
}: {
  linkProps: TCardLinkProps | null | undefined;
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
  } = useMutation({
    mutationFn: deleteProjectFn,
    onSuccess: () => {
      invalidate();
    },
  });
  const router = useRouter();

  if (linkProps === undefined) {
    return (
      <Button variant={variant} className={className}>
        {children}
      </Button>
    );
  }

  if (linkProps === null) {
    return (
      <DeleteEntityTrigger
        dialogTitle="Delete Project"
        dialogDescription="Are you sure you want to delete this project? This action cannot be undone. All environments, services, and data inside this project will be permanently deleted."
        deletingEntityName={project?.name || "Project"}
        onDialogClose={reset}
        onSubmit={async () => {
          if (!project) return;
          await deleteProject({ teamId: project.team_id, projectId: project.id });
          await router.navigate({ to: "/$team_id", params: { team_id: project.team_id } });
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
    <LinkButton {...linkProps} variant={variant} className={className}>
      {children}
    </LinkButton>
  );
}
