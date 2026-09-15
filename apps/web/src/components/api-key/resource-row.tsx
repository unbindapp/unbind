"use client";

import { allValue, strongestRole, type TResourceRow } from "@/components/api-key/helpers";
import { BlockItemButtonLike } from "@/components/block";
import {
  ServicePickerItem,
  ServicePickerTriggerIcon,
  getDuplicateServiceNames,
} from "@/components/service/service-picker";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TAsyncAndSearchableSelectProps, TCommandItem } from "@/lib/hooks/use-app-form";
import { environmentsListQuery } from "@/lib/queries/environments";
import { projectsListQuery } from "@/lib/queries/projects";
import { servicesListQuery } from "@/lib/queries/services";
import { teamsListQuery } from "@/lib/queries/teams";
import type { PermittedAction } from "@/lib/server/client.gen";
import { useQuery } from "@tanstack/react-query";
import { AnyFieldApi } from "@tanstack/react-form";
import { BoxIcon, ContainerIcon, FolderIcon, UsersIcon, XIcon } from "lucide-react";
import { FC, useCallback, useEffect, useMemo } from "react";

type TSelectField = AnyFieldApi & {
  AsyncAndSearchableSelect: FC<TAsyncAndSearchableSelectProps>;
};

type TProps = {
  field: TSelectField;
  row: TResourceRow;
  onChange: (row: TResourceRow) => void;
  onRemove: () => void;
  // Strongest role the owner holds on the row's deepest pick, null when none
  onCapChange: (cap: PermittedAction | null) => void;
  index: number;
  className?: string;
};

const allItem = (label: string): TCommandItem => ({ value: allValue, label, keywords: ["all"] });

export default function ResourceRow({
  field,
  row,
  onChange,
  onRemove,
  onCapChange,
  className,
  index,
}: TProps) {
  const teams = useQuery(teamsListQuery());
  const projects = useQuery({
    ...projectsListQuery({ teamId: row.teamId }),
    enabled: row.teamId !== "",
  });
  const environments = useQuery({
    ...environmentsListQuery({ teamId: row.teamId, projectId: row.projectId }),
    enabled: row.teamId !== "" && row.projectId !== allValue,
  });
  const services = useQuery({
    ...servicesListQuery({
      teamId: row.teamId,
      projectId: row.projectId,
      environmentId: row.environmentId,
    }),
    enabled: row.teamId !== "" && row.projectId !== allValue && row.environmentId !== allValue,
  });

  const team = teams.data?.teams.find((t) => t.id === row.teamId);
  const project = projects.data?.projects.find((p) => p.id === row.projectId);
  const environment = environments.data?.environments.find((e) => e.id === row.environmentId);
  const service = services.data?.services.find((s) => s.id === row.serviceId);

  // "All" is only offered where the owner can act on the parent itself; a
  // parent that is merely on the path to something forces a deeper pick.
  const teamItems = useMemo<TCommandItem[] | undefined>(
    () => teams.data?.teams.map((t) => ({ value: t.id, label: t.name, keywords: [t.name] })),
    [teams.data],
  );
  const projectItems = useMemo<TCommandItem[] | undefined>(() => {
    if (!projects.data) return undefined;
    const items = projects.data.projects.map((p) => ({
      value: p.id,
      label: p.name,
      keywords: [p.name],
    }));
    return team && team.permissions.length > 0 ? [allItem("All projects"), ...items] : items;
  }, [projects.data, team]);
  const environmentItems = useMemo<TCommandItem[] | undefined>(() => {
    if (!environments.data) return undefined;
    const items = environments.data.environments.map((e) => ({
      value: e.id,
      label: e.name,
      keywords: [e.name],
    }));
    return project && project.permissions.length > 0
      ? [allItem("All environments"), ...items]
      : items;
  }, [environments.data, project]);
  const serviceItems = useMemo<TCommandItem[] | undefined>(() => {
    if (!services.data) return undefined;
    const items = services.data.services.map((s) => ({
      value: s.id,
      label: s.name,
      keywords: [s.name],
    }));
    return environment && environment.permissions.length > 0
      ? [allItem("All services"), ...items]
      : items;
  }, [services.data, environment]);

  const deepest =
    row.serviceId !== allValue
      ? service
      : row.environmentId !== allValue
        ? environment
        : row.projectId !== allValue
          ? project
          : team;
  const cap = strongestRole(deepest?.permissions);
  useEffect(() => {
    onCapChange(cap);
  }, [cap, onCapChange]);

  const ServiceItemElement = useCallback(
    ({ item, className }: { item: TCommandItem; className?: string }) => {
      const s = services.data?.services.find((svc) => svc.id === item.value);
      if (!s) return <p className={cn("min-w-0 leading-tight", className)}>{item.label}</p>;
      const duplicates = getDuplicateServiceNames(services.data?.services ?? []);
      return (
        <ServicePickerItem
          service={s}
          showDescription={duplicates.has(s.name)}
          className={className}
        />
      );
    },
    [services.data],
  );

  const Select = field.AsyncAndSearchableSelect;
  // Fixed halves so a pick adding the next select never reflows the ones before it
  const selectClassName = "w-full lg:w-[calc((100%-0.5rem)/2)]";

  return (
    <div className={cn("flex w-full flex-col items-start gap-2 rounded-xl border p-2", className)}>
      <div className="flex w-full justify-between gap-4">
        <p className="min-w-0 flex-1 truncate px-2 py-0.5 leading-tight font-medium">
          Resource {index + 1}
        </p>
        <Button
          type="button"
          aria-label="Remove row"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-muted-more-foreground -my-1 -mr-1 size-8.5 shrink-0 rounded-lg"
        >
          <XIcon className="size-4.5" />
        </Button>
      </div>
      <div className="flex w-full items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Select
            field={field}
            hideError
            className={selectClassName}
            value={row.teamId}
            onChange={(v: string) =>
              onChange({
                ...row,
                teamId: v,
                projectId: allValue,
                environmentId: allValue,
                serviceId: allValue,
              })
            }
            items={teamItems}
            isPending={teams.isPending}
            error={teams.error?.message}
            commandInputPlaceholder="Search teams..."
            CommandEmptyText="No teams found"
            CommandEmptyIcon={UsersIcon}
          >
            {({ isOpen }: { isOpen: boolean }) => (
              <BlockItemButtonLike
                asElement="button"
                text={team?.name ?? "Select a team"}
                Icon={({ className }) => <UsersIcon className={className} />}
                open={isOpen}
                isPending={teams.isPending}
              />
            )}
          </Select>
          {row.teamId !== "" && (
            <Select
              field={field}
              hideError
              className={selectClassName}
              value={row.projectId}
              onChange={(v: string) =>
                onChange({ ...row, projectId: v, environmentId: allValue, serviceId: allValue })
              }
              items={projectItems}
              isPending={projects.isPending}
              error={projects.error?.message}
              commandInputPlaceholder="Search projects..."
              CommandEmptyText="No projects found"
              CommandEmptyIcon={FolderIcon}
            >
              {({ isOpen }: { isOpen: boolean }) => (
                <BlockItemButtonLike
                  asElement="button"
                  text={
                    row.projectId === allValue
                      ? "All projects"
                      : (project?.name ?? "Select a project")
                  }
                  Icon={({ className }) => <FolderIcon className={className} />}
                  open={isOpen}
                  isPending={projects.isPending}
                />
              )}
            </Select>
          )}
          {row.teamId !== "" && row.projectId !== allValue && (
            <Select
              field={field}
              hideError
              className={selectClassName}
              value={row.environmentId}
              onChange={(v: string) => onChange({ ...row, environmentId: v, serviceId: allValue })}
              items={environmentItems}
              isPending={environments.isPending}
              error={environments.error?.message}
              commandInputPlaceholder="Search environments..."
              CommandEmptyText="No environments found"
              CommandEmptyIcon={ContainerIcon}
            >
              {({ isOpen }: { isOpen: boolean }) => (
                <BlockItemButtonLike
                  asElement="button"
                  text={
                    row.environmentId === allValue
                      ? "All environments"
                      : (environment?.name ?? "Select an environment")
                  }
                  Icon={({ className }) => <ContainerIcon className={className} />}
                  open={isOpen}
                  isPending={environments.isPending}
                />
              )}
            </Select>
          )}
          {row.teamId !== "" && row.projectId !== allValue && row.environmentId !== allValue && (
            <Select
              field={field}
              hideError
              className={selectClassName}
              value={row.serviceId}
              onChange={(v: string) => onChange({ ...row, serviceId: v })}
              items={serviceItems}
              isPending={services.isPending}
              error={services.error?.message}
              commandInputPlaceholder="Search services..."
              CommandEmptyText="No services found"
              CommandEmptyIcon={BoxIcon}
              CommandItemElement={ServiceItemElement}
            >
              {({ isOpen }: { isOpen: boolean }) => (
                <BlockItemButtonLike
                  asElement="button"
                  text={
                    row.serviceId === allValue
                      ? "All services"
                      : (service?.name ?? "Select a service")
                  }
                  Icon={({ className }) => (
                    <ServicePickerTriggerIcon service={service} className={className} />
                  )}
                  open={isOpen}
                  isPending={services.isPending}
                />
              )}
            </Select>
          )}
        </div>
      </div>
    </div>
  );
}
