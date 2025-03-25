import ServiceIcon from "@/components/icons/service";
import { useService } from "@/components/service/service-provider";
import CreateVariablesForm from "@/components/service/tabs/variables/create-variables-form";
import VariablesProvider from "@/components/service/tabs/variables/variables-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { TVariableForCreate } from "@/server/trpc/api/variables/types";
import { GitBranchIcon } from "lucide-react";
import { useState } from "react";

type TProps = {
  service: TServiceShallow;
};

export default function UndeployedServiceContent({ service }: TProps) {
  const { teamId, projectId, environmentId } = useService();
  const [variables, setVariables] = useState<TVariableForCreate[]>([]);

  return (
    <div className="mt-4 flex w-full flex-1 flex-col overflow-hidden border-t sm:mt-6">
      <ScrollArea viewportClassName="pb-[calc(var(--safe-area-inset-bottom)+2rem)]">
        <div className="flex w-full flex-1 flex-col gap-4 overflow-auto px-3 py-4 sm:p-6">
          <h2 className="-mt-1 px-2 text-xl font-bold sm:text-2xl">Deploy Service</h2>
          {service.git_repository && (
            <div className="flex w-full flex-col gap-4 sm:flex-row">
              <div className="flex w-full flex-col gap-1 sm:w-1/2">
                <p className="w-full px-2 leading-tight font-medium">Source</p>
                <div className="mt-1 flex w-full flex-row items-center gap-2 rounded-xl border px-3.5 py-2.5">
                  <ServiceIcon variant="github" className="size-5 shrink-0" />
                  <p className="min-w-0 shrink truncate font-medium">{service.git_repository}</p>
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
          >
            <CreateVariablesForm
              variant="collapsible"
              onBlur={(v) => {
                setVariables(v.value.variables);
              }}
            />
          </VariablesProvider>
          <Button onClick={() => console.log("VARIABLES", variables)}>Deploy</Button>
        </div>
      </ScrollArea>
    </div>
  );
}
