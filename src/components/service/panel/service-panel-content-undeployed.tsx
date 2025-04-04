import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useDeployments } from "@/components/service/deployments-provider";
import { useService } from "@/components/service/service-provider";
import { useServicesUtils } from "@/components/project/services-provider";
import CreateVariablesForm, {
  CreateVariablesFormSchema,
  TCreateVariablesForm,
} from "@/components/service/panel/tabs/variables/create-variables-form";
import VariablesProvider from "@/components/service/panel/tabs/variables/variables-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { TVariableForCreate, VariableForCreateSchema } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { GitBranchIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/components/ui/utils";

type TProps = {
  service: TServiceShallow;
  className?: string;
};

export default function UndeployedServiceContent({ service, className }: TProps) {
  const {
    teamId,
    projectId,
    environmentId,
    query: { refetch: refetchService },
  } = useService();
  const { refetch: refetchServices } = useServicesUtils({ teamId, projectId, environmentId });
  const {
    query: { refetch: refetchDeployments },
  } = useDeployments();

  const [variables, setVariables] = useState<TVariableForCreate[]>([]);

  const { mutateAsync: createDeployment, error: deploymentError } =
    api.deployments.create.useMutation();
  const { mutateAsync: upsertVariables, error: errorVariables } =
    api.variables.upsert.useMutation();

  const form = useAppForm({
    defaultValues: {},
    validators: {},
    onSubmit: async ({ formApi }) => {
      const parsedVariables: TCreateVariablesForm = { variables: [] };

      for (const variable of variables) {
        const { success, data } = VariableForCreateSchema.safeParse(variable);
        if (success) {
          parsedVariables.variables.push(data);
        }
      }

      const { success, data } = CreateVariablesFormSchema.safeParse(parsedVariables);

      if (success) {
        await upsertVariables({
          teamId,
          projectId,
          environmentId,
          serviceId: service.id,
          variables: data.variables,
          type: "service",
        });
      }

      await createDeployment({
        teamId,
        projectId,
        environmentId,
        serviceId: service.id,
      });

      await Promise.all([refetchServices(), refetchService(), refetchDeployments()]);

      formApi.reset();
    },
  });

  return (
    <div
      className={cn("mt-4 flex w-full flex-1 flex-col overflow-hidden border-t sm:mt-6", className)}
    >
      <ScrollArea viewportClassName="pb-[calc(var(--safe-area-inset-bottom)+2rem)]">
        <div className="flex w-full flex-1 flex-col gap-4 overflow-auto px-3 py-4 sm:p-6">
          <h2 className="-mt-1 px-2 text-xl font-bold sm:text-2xl">Deploy Service</h2>
          {service.git_repository && (
            <div className="flex w-full flex-col gap-4 sm:flex-row">
              <div className="flex w-full flex-col gap-1 sm:w-1/2">
                <p className="w-full px-2 leading-tight font-medium">Source</p>
                <div className="mt-1 flex w-full flex-row items-center gap-2 rounded-xl border px-3.5 py-2.5">
                  <BrandIcon brand="github" className="size-5 shrink-0" />
                  <p className="min-w-0 shrink truncate font-medium">{`${service.git_repository_owner}/${service.git_repository}`}</p>
                </div>
              </div>
              <div className="flex w-full flex-col gap-1 sm:w-1/2">
                <p className="w-full px-2 leading-none font-medium">Branch</p>
                <div className="mt-1 flex w-full flex-row items-center gap-2 rounded-xl border px-3.5 py-2.5">
                  <GitBranchIcon className="size-5 shrink-0" />
                  <p className="min-w-0 shrink truncate font-medium">{service.config.git_branch}</p>
                </div>
              </div>
            </div>
          )}
          <VariablesProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={service.id}
            type="service"
          >
            <CreateVariablesForm
              variant="collapsible"
              onBlur={(v) => {
                setVariables(v.value.variables);
              }}
            />
          </VariablesProvider>
          {deploymentError && <ErrorLine message={deploymentError.message} />}
          {errorVariables && <ErrorLine message={errorVariables.message} />}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting, state.values]}
              children={([canSubmit, isSubmitting]) => (
                <form.SubmitButton
                  className="w-full"
                  disabled={!canSubmit}
                  isPending={isSubmitting ? true : false}
                >
                  Deploy
                </form.SubmitButton>
              )}
            />
          </form>
        </div>
      </ScrollArea>
    </div>
  );
}
