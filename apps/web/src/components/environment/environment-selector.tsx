"use client";

import {
  CreateEnvironmentDialog,
  TCreateEnvironmentDialogProps,
} from "@/components/environment/create-environment-dialog";
import { BreadcrumbItem, TBreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { useProjects } from "@/components/project/projects-provider";
import { Button, TButtonProps } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { servicesListQuery } from "@/lib/queries/services";
import { ChevronDownIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { errAsync, ResultAsync } from "neverthrow";
import { ReactNode, useCallback, useEffect, useState } from "react";

export default function EnvironmentSelector() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: projectsData } = useProjects();

  const {
    teamId: teamIdFromPathname,
    projectId: projectIdFromPathname,
    environmentId: environmentIdFromPathname,
  } = useIdsFromPathname();

  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromPathname);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(environmentIdFromPathname);
  const [isEnvironmentsMenuOpen, setIsEnvironmentsMenuOpen] = useState(false);

  useEffect(() => {
    setSelectedProjectId(projectIdFromPathname);
  }, [projectIdFromPathname, projectsData]);

  useEffect(() => {
    setSelectedEnvironmentId(environmentIdFromPathname);
  }, [environmentIdFromPathname]);

  const selectedProject = selectedProjectId
    ? projectsData?.projects.find((p) => p.id === selectedProjectId)
    : undefined;

  const selectedEnvironment = selectedProject?.environments.find(
    (e) => e.id === selectedEnvironmentId,
  );

  // Switching environment stays on the current route and only swaps the
  // `environment` search param, preserving any other search params.
  const onEnvironmentIdSelect = useCallback(
    async (id: string) => {
      setSelectedEnvironmentId(id);
      await router.navigate({ to: ".", search: (prev) => ({ ...prev, environment: id }) });
    },
    [router],
  );

  const onEnvironmentIdIntent = useCallback(
    (id: string) => {
      if (!teamIdFromPathname || !selectedProjectId) return;
      void queryClient.prefetchQuery(
        servicesListQuery({
          teamId: teamIdFromPathname,
          projectId: selectedProjectId,
          environmentId: id,
        }),
      );
    },
    [queryClient, teamIdFromPathname, selectedProjectId],
  );

  const getEnvironmentManageItemNav = useCallback(() => {
    if (!teamIdFromPathname || !selectedProjectId) return null;
    return {
      to: "/$team_id/project/$project_id/settings/environments",
      params: { team_id: teamIdFromPathname, project_id: selectedProjectId },
      search: { environment: environmentIdFromPathname || selectedEnvironmentId || undefined },
    } as const;
  }, [teamIdFromPathname, selectedProjectId, environmentIdFromPathname, selectedEnvironmentId]);

  const onSelectEnvironmentManageItem = useCallback(() => {
    const nav = getEnvironmentManageItemNav();
    if (nav) void router.navigate(nav);
  }, [getEnvironmentManageItemNav, router]);

  const onIntentEnvironmentManageItem = useCallback(() => {
    const nav = getEnvironmentManageItemNav();
    if (nav) void router.preloadRoute(nav);
  }, [getEnvironmentManageItemNav, router]);

  const CreateEnvironmentDialogMemoized: (
    props: Omit<
      TCreateEnvironmentDialogProps,
      "onFormSubmitSuccessful" | "asyncOnFormSubmitSuccessful"
    >,
  ) => ReactNode = useCallback(
    (props) => (
      <CreateEnvironmentDialog
        {...props}
        onFormSubmitSuccessful={() => setIsEnvironmentsMenuOpen(false)}
        asyncOnFormSubmitSuccessful={({ environment }) => {
          if (!teamIdFromPathname || !selectedProjectId) {
            return errAsync(new Error("Team or project ID is missing"));
          }
          return ResultAsync.fromPromise(
            router.navigate({
              to: ".",
              search: (prev) => ({ ...prev, environment: environment.id }),
            }),
            () => new Error("Failed to navigate to project"),
          );
        }}
        dialogOnOpenChange={(o) => {
          if (!o) setIsEnvironmentsMenuOpen(false);
        }}
      />
    ),
    [teamIdFromPathname, selectedProjectId, router],
  );

  return (
    <BreadcrumbItem
      flipChevronOnSm
      title="Environments"
      selectedItem={selectedEnvironment}
      items={selectedProject?.environments}
      open={isEnvironmentsMenuOpen}
      setOpen={setIsEnvironmentsMenuOpen}
      onSelect={onEnvironmentIdSelect}
      onIntent={onEnvironmentIdIntent}
      newItemTitle="New Environment"
      newItemIsPending={false}
      NewItemWrapper={CreateEnvironmentDialogMemoized}
      newItemDontCloseMenuOnSelect={true}
      onSelectNewItem={() => null}
      manageItemTitle="Manage"
      onSelectManageItem={onSelectEnvironmentManageItem}
      onIntentManageItem={onIntentEnvironmentManageItem}
      sideOffset={4}
    >
      <Trigger item={selectedEnvironment} isOpen={isEnvironmentsMenuOpen} />
    </BreadcrumbItem>
  );
}

function Trigger<T>({
  item,
  isOpen,
  className,
  ...rest
}: { item: TBreadcrumbItem<T> | null | undefined; isOpen: boolean } & TButtonProps) {
  return (
    <Button
      {...rest}
      variant="outline"
      data-open={isOpen || undefined}
      data-pending={item === undefined || undefined}
      className={cn(
        "group/button text-muted-foreground max-w-32 gap-1 rounded-md px-2.25 py-1.25 text-sm leading-tight font-medium",
        className,
      )}
    >
      <p className="group-data-pending/button:bg-foreground group-data-pending/button:animate-skeleton min-w-0 shrink truncate group-data-pending/button:rounded-sm group-data-pending/button:text-transparent">
        {item === undefined ? "Loading" : item === null ? "Not found" : item.name}
      </p>
      <ChevronDownIcon className="text-muted-more-foreground -mr-0.75 size-4 transition group-data-open/button:rotate-180" />
    </Button>
  );
}
