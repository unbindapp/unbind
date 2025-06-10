import { useServicesUtils } from "@/components/service/services-provider";
import ServiceIcon from "@/components/service/service-icon";
import { useServiceUtils } from "@/components/service/service-provider";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
import { Button } from "@/components/ui/button";
import { ServiceRenameSchema, TServiceShallow } from "@/server/trpc/api/services/types";
import { api } from "@/server/trpc/setup/client";
import { PenIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { toast } from "sonner";

type TProps = {
  service: TServiceShallow;
  teamId: string;
  projectId: string;
  environmentId: string;
};

export default function TitleButton({ service, teamId, projectId, environmentId }: TProps) {
  const { mutateAsync: updateService, error, reset } = api.services.update.useMutation();
  const { refetch: refetchService } = useServiceUtils({
    teamId,
    projectId,
    environmentId,
    serviceId: service.id,
  });
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });

  return (
    <RenameEntityTrigger
      type="name-and-description"
      dialogTitle="Rename Service"
      dialogDescription="Give a new name and description to the service."
      nameInputTitle="Service Name"
      descriptionInputTitle="Service Description"
      name={service.name}
      description={service.description}
      formSchema={ServiceRenameSchema}
      error={error}
      onDialogClose={() => reset()}
      onSubmit={async (value) => {
        await updateService({
          teamId,
          projectId,
          environmentId,
          serviceId: service.id,
          name: value.name,
          description: value.description,
        });

        const refetchRes = await ResultAsync.fromPromise(
          Promise.all([refetchService(), refetchServices()]),
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
        className="group/button -my-1 -ml-2.5 flex min-w-0 shrink items-center justify-start gap-2 px-2.5 py-1"
      >
        <ServiceIcon service={service} color="brand" className="-ml-1 size-6 sm:size-7" />
        <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">{service.name}</p>
        <PenIcon className="ml-0.5 size-4 -rotate-30 opacity-0 transition group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 has-hover:group-hover/button:rotate-0 has-hover:group-hover/button:opacity-100 sm:size-4.5" />
      </Button>
    </RenameEntityTrigger>
  );
}
