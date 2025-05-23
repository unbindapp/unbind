import { NewEntityIndicator } from "@/components/new-entity-indicator";
import ServiceCard from "@/components/project/service-card";
import { TServiceGroup } from "@/components/project/service-card-list";
import { useServicesUtils } from "@/components/project/services-provider";
import ServiceGroupIcon from "@/components/service/service-group-icon";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ServiceRenameSchema } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { PenIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { toast } from "sonner";

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
        <div className="flex w-full items-center gap-2 px-4 pt-2.5 pb-1.5">
          <TitleButton
            serviceGroup={groupObject}
            teamId={teamId}
            environmentId={environmentId}
            projectId={projectId}
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

function TitleButton({
  serviceGroup,
  teamId,
  projectId,
  environmentId,
}: {
  serviceGroup: TServiceGroup;
  teamId: string;
  projectId: string;
  environmentId: string;
}) {
  const { mutateAsync: updateServiceGroup, error, reset } = api.serviceGroups.update.useMutation();
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });

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
      onSubmit={async (value) => {
        await updateServiceGroup({
          id: serviceGroup.group.id,
          teamId,
          projectId,
          environmentId,
          name: value.name,
          description: value.description,
        });

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
      }}
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
    </RenameEntityTrigger>
  );
}
