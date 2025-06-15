import { NewEntityIndicator } from "@/components/new-entity-indicator";
import ServiceCard from "@/components/service/service-card";
import { TServiceGroup } from "@/components/service/service-card-list";
import { useServicesUtils } from "@/components/service/services-provider";
import ServiceGroupIcon from "@/components/service/service-group-icon";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ServiceRenameSchema } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { EllipsisVerticalIcon, PenIcon, Trash2Icon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { toast } from "sonner";
import { ReactNode, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";

type TProps = {
  groupObject: TServiceGroup;
  teamId: string;
  projectId: string;
  environmentId: string;
  className?: string;
  classNameServiceCard?: string;
} & React.HTMLProps<HTMLLIElement>;

export default function ServiceGroupCard({
  groupObject,
  teamId,
  projectId,
  environmentId,
  className,
  classNameServiceCard,
  ...rest
}: TProps) {
  return (
    <li className={cn("flex w-full p-1", className)} {...rest}>
      <div className="relative flex w-full flex-col rounded-xl border bg-[radial-gradient(color-mix(in_oklab,var(--border)_60%,transparent)_1px,transparent_1px),radial-gradient(color-mix(in_oklab,var(--border)_60%,transparent)_1px,transparent_1px)] [background-size:10px_10px] [background-position:0px_0px,5px_5px]">
        <NewEntityIndicator id={groupObject.group.id} />
        <div className="flex w-full items-center gap-2 px-4 pt-2.5 pr-10 pb-1.5">
          <TitleButton
            serviceGroup={groupObject}
            teamId={teamId}
            environmentId={environmentId}
            projectId={projectId}
          />
          <ThreeDotButton
            serviceGroup={groupObject}
            teamId={teamId}
            environmentId={environmentId}
            projectId={projectId}
            className="absolute top-1 right-1"
          />
        </div>
        <ol className="flex w-full flex-wrap p-1">
          {groupObject.services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
              className={cn("min-h-36", classNameServiceCard)}
              classNameCard="rounded-lg"
              classNameVolumes="rounded-b-lg"
              classNameVolumeLast="rounded-b-lg"
            />
          ))}
        </ol>
      </div>
    </li>
  );
}

type TTitleButtonProps = {
  serviceGroup: TServiceGroup;
  teamId: string;
  projectId: string;
  environmentId: string;
};

function TitleButton({ serviceGroup, teamId, projectId, environmentId }: TTitleButtonProps) {
  return (
    <RenameTrigger
      serviceGroup={serviceGroup}
      teamId={teamId}
      projectId={projectId}
      environmentId={environmentId}
    >
      <Button
        variant="ghost"
        className="group/button -my-1 -ml-2 flex min-w-0 shrink items-center justify-start gap-2 rounded-md px-2 py-1"
      >
        <ServiceGroupIcon groupObject={serviceGroup} color="brand" className="-ml-1 size-6" />
        <p className="min-w-0 shrink text-left leading-tight font-semibold">
          {serviceGroup.group.name}
        </p>
        <PenIcon className="size-4 -rotate-30 opacity-0 transition group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 has-hover:group-hover/button:rotate-0 has-hover:group-hover/button:opacity-100" />
      </Button>
    </RenameTrigger>
  );
}

type TThreeDotButtonProps = {
  serviceGroup: TServiceGroup;
  teamId: string;
  projectId: string;
  environmentId: string;
  className?: string;
};

function ThreeDotButton({
  serviceGroup,
  teamId,
  projectId,
  environmentId,
  className,
}: TThreeDotButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isOpen ? true : undefined}
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-more-foreground group/button shrink-0 rounded-lg group-data-placeholder/card:text-transparent",
            className,
          )}
        >
          <EllipsisVerticalIcon className="size-6 rotate-90 transition-transform group-data-open/button:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="z-50 w-40"
        sideOffset={-1}
        data-open={isOpen ? true : undefined}
        align="end"
        forceMount={true}
      >
        <ScrollArea>
          <DropdownMenuGroup>
            <RenameTrigger
              serviceGroup={serviceGroup}
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
              onSuccess={() => setIsOpen(false)}
              onDialogCloseImmediate={() => setIsOpen(false)}
            >
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <PenIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Rename</p>
              </DropdownMenuItem>
            </RenameTrigger>
            <DeleteTrigger
              serviceGroup={serviceGroup}
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
              onSuccess={() => setIsOpen(false)}
              onDialogCloseImmediate={() => setIsOpen(false)}
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <Trash2Icon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TRenameTriggerProps = {
  serviceGroup: TServiceGroup;
  teamId: string;
  projectId: string;
  environmentId: string;
  onDialogCloseImmediate?: () => void;
  onSuccess?: () => void;
  children: ReactNode;
};

function RenameTrigger({
  serviceGroup,
  teamId,
  projectId,
  environmentId,
  onDialogCloseImmediate,
  onSuccess,
  children,
}: TRenameTriggerProps) {
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });

  const {
    mutateAsync: updateServiceGroup,
    error,
    reset,
  } = api.serviceGroups.update.useMutation({
    onSuccess: async () => {
      const refetchRes = await ResultAsync.fromPromise(
        refetchServices(),
        () => new Error("Failed to refetch services"),
      );

      if (refetchRes.isErr()) {
        console.error(refetchRes.error);
        toast.error("Failed to refetch services", {
          description: refetchRes.error.message,
        });
      }
      onSuccess?.();
    },
  });

  return (
    <RenameEntityTrigger
      type="name-and-description"
      dialogTitle="Rename Service Group"
      dialogDescription="Give a new name and description to the service group."
      nameInputTitle="Service Group Name"
      descriptionInputTitle="Service Group Description"
      name={serviceGroup.group.name}
      description={serviceGroup.group.description || ""}
      formSchema={ServiceRenameSchema}
      error={error}
      onDialogClose={() => reset()}
      onDialogCloseImmediate={() => {
        onDialogCloseImmediate?.();
      }}
      onSubmit={async (value) => {
        await updateServiceGroup({
          id: serviceGroup.group.id,
          teamId,
          projectId,
          environmentId,
          name: value.name,
          description: value.description,
        });
      }}
    >
      {children}
    </RenameEntityTrigger>
  );
}

type TDeleteTriggerProps = {
  serviceGroup: TServiceGroup;
  teamId: string;
  projectId: string;
  environmentId: string;
  children: ReactNode;
  onDialogCloseImmediate?: () => void;
  onSuccess?: () => void;
};

function DeleteTrigger({
  serviceGroup,
  teamId,
  projectId,
  environmentId,
  onSuccess,
  onDialogCloseImmediate,
  children,
}: TDeleteTriggerProps) {
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });

  const {
    mutateAsync: deleteGroup,
    error: errorDeleteGroup,
    reset: resetDeleteGroup,
  } = api.serviceGroups.delete.useMutation({
    onSuccess: async () => {
      const result = await ResultAsync.fromPromise(
        refetchServices(),
        () => new Error("Failed to refetch services"),
      );
      if (result.isErr()) {
        toast.error("Failed to refetch services", {
          description:
            "Successfully deleted the service group, but failed to refetch services. Please refresh the page.",
        });
      }
      onSuccess?.();
    },
  });

  return (
    <DeleteEntityTrigger
      dialogTitle="Delete Services Group"
      dialogDescription="All services inside the group will be deleted permanently. This action cannot be undone."
      onSubmit={async () => {
        await deleteGroup({
          id: serviceGroup.group.id,
          teamId,
          projectId,
          environmentId,
          deleteServices: true,
        });
      }}
      error={errorDeleteGroup}
      deletingEntityName={`${serviceGroup.group.name} and all services inside it`}
      onDialogCloseImmediate={() => {
        onDialogCloseImmediate?.();
      }}
      onDialogClose={() => {
        resetDeleteGroup();
      }}
    >
      {children}
    </DeleteEntityTrigger>
  );
}
