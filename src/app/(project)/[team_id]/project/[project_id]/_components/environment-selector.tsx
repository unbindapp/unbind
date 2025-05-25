"use client";

import {
  CreateEnvironmentDialog,
  TCreateEnvironmentDialogProps,
} from "@/components/environment/create-environment-dialog";
import { BreadcrumbItem, TBreadcrumbItem } from "@/components/navigation/breadcrumb-item";
import { useProjects } from "@/components/project/projects-provider";
import { useAsyncPush } from "@/components/providers/async-push-provider";
import { Button, TButtonProps } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useIdsFromPathname } from "@/lib/hooks/use-ids-from-pathname";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";

export default function EnvironmentSelector() {
  const { asyncPush } = useAsyncPush();
  const router = useRouter();

  const { data: projectsData } = useProjects();

  const { projectId: projectIdFromPathname, environmentId: environmentIdFromPathname } =
    useIdsFromPathname();

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

  const getHrefForEnvironmentId = useCallback(
    (id: string) => {
      const project = projectsData?.projects.find((p) => p.id === selectedProjectId);
      const environment = project?.environments.find((e) => e.id === id);
      if (!project || !environment) return null;
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("environment", environment.id);
      return newUrl.toString();
    },
    [projectsData, selectedProjectId],
  );

  const onEnvironmentIdSelect = useCallback(
    async (id: string) => {
      setSelectedEnvironmentId(id);
      const href = getHrefForEnvironmentId(id);
      if (!href) return;
      await asyncPush(href);
    },
    [getHrefForEnvironmentId, asyncPush],
  );

  const onEnvironmentIdHover = useCallback(
    (id: string) => {
      const href = getHrefForEnvironmentId(id);
      if (!href) return;
      router.prefetch(href);
    },
    [getHrefForEnvironmentId, router],
  );

  const CreateEnvironmentDialogMemoized: (
    props: Omit<TCreateEnvironmentDialogProps, "onFormSubmitSuccessful">,
  ) => ReactNode = useCallback(
    (props) => (
      <CreateEnvironmentDialog
        {...props}
        onFormSubmitSuccessful={() => setIsEnvironmentsMenuOpen(false)}
        dialogOnOpenChange={(o) => {
          if (!o) setIsEnvironmentsMenuOpen(false);
        }}
      />
    ),
    [],
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
      onHover={onEnvironmentIdHover}
      newItemTitle="New Environment"
      newItemIsPending={false}
      NewItemWrapper={CreateEnvironmentDialogMemoized}
      newItemDontCloseMenuOnSelect={true}
      onSelectNewItem={() => null}
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
}: { item?: TBreadcrumbItem<T>; isOpen: boolean } & TButtonProps) {
  return (
    <Button
      {...rest}
      variant="outline"
      data-open={isOpen ? true : undefined}
      className={cn(
        "group/button text-muted-foreground gap-1 rounded-md px-2.25 py-1.25 text-sm leading-tight font-medium",
        className,
      )}
    >
      <p className="min-w-0 shrink truncate">{item?.name || "Not found"}</p>
      <ChevronDownIcon className="text-muted-more-foreground -mr-0.75 size-4 transition group-data-open/button:rotate-180" />
    </Button>
  );
}
