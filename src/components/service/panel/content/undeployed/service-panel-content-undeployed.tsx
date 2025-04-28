import { useDeployments } from "@/components/deployment/deployments-provider";
import ErrorLine from "@/components/error-line";
import { useServicesUtils } from "@/components/project/services-provider";
import {
  Block,
  BlockItem,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { DomainCard } from "@/components/service/panel/content/undeployed/domain-card";
import { UndeployedContentDatabase } from "@/components/service/panel/content/undeployed/undeployed-content-database";
import { UndeployedContentDockerImage } from "@/components/service/panel/content/undeployed/undeployed-content-docker-image";
import { UndeployedContentGit } from "@/components/service/panel/content/undeployed/undeployed-content-git";
import { useService } from "@/components/service/service-provider";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import CreateVariablesForm, {
  CreateVariablesFormSchema,
  TCreateVariablesForm,
} from "@/components/variables/create-variables-form";
import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesProvider from "@/components/variables/variables-provider";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { TVariableForCreate, VariableForCreateSchema } from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { CheckCircleIcon, CircleSlashIcon } from "lucide-react";
import { Dispatch, SetStateAction, useState } from "react";

type TProps = {
  service: TServiceShallow;
  className?: string;
};

export default function ServicePanelContentUndeployed({ service, className }: TProps) {
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
    api.variables.createOrUpdate.useMutation();

  const tagState = useState<string | null>(null);
  const branchState = useState<string | null>(null);
  const databaseVersionState = useState<string | null>(null);

  const [domain, setDomain] = useState<string>("");

  const port =
    service.config.ports && service.config.ports?.length > 0 ? service.config.ports[0].port : null;
  const [portInputValue, setPortInputValue] = useState<string>(port?.toString() || "");

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
          variableReferences: [],
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

  const hasDomainAndPort =
    service.config.type === "github" || service.config.type === "docker-image";

  return (
    <div
      className={cn("mt-4 flex w-full flex-1 flex-col overflow-hidden border-t sm:mt-6", className)}
    >
      <ScrollArea viewportClassName="pb-[calc(var(--safe-area-inset-bottom)+2rem)]">
        <div className="flex w-full flex-1 flex-col gap-5 overflow-auto px-3 py-4 sm:p-6">
          <h2 className="-mt-1 px-2 text-xl font-bold sm:text-2xl">Deploy Service</h2>
          <Content
            service={service}
            tagState={tagState}
            branchState={branchState}
            databaseVersionState={databaseVersionState}
          />
          {hasDomainAndPort && (
            <Block>
              <BlockItem>
                <BlockItemHeader>
                  <BlockItemTitle>Domain</BlockItemTitle>
                </BlockItemHeader>
                <BlockItemContent>
                  <div className="flex w-full flex-col items-start">
                    <Input
                      value={domain}
                      onChange={(e) => setDomain(e.currentTarget.value)}
                      placeholder="example.com"
                      className="z-10 w-full"
                    />
                    <DomainCard domain={domain} className="-mt-3 rounded-t-none pt-2.75" />
                  </div>
                </BlockItemContent>
              </BlockItem>
              <BlockItem>
                <BlockItemHeader>
                  <BlockItemTitle>Port</BlockItemTitle>
                  <div
                    data-detected={port !== null ? true : undefined}
                    className="bg-warning/10 text-warning border-warning/10 data-detected:text-success data-detected:bg-success/10 data-detected:border-success/10 -my-1 flex min-w-0 shrink items-center justify-start gap-1.5 rounded-full border px-1.75 py-0.25"
                  >
                    {port !== null ? (
                      <CheckCircleIcon className="-ml-0.75 size-3.5 shrink-0" />
                    ) : (
                      <CircleSlashIcon className="-ml-0.75 size-3.5 shrink-0" />
                    )}
                    <p className="min-w-0 shrink truncate text-sm leading-tight font-medium">
                      {port !== null ? (
                        <>
                          {" "}
                          Detected: <span className="font-bold">{port}</span>
                        </>
                      ) : (
                        "Couldn't detect"
                      )}
                    </p>
                  </div>
                </BlockItemHeader>
                <BlockItemContent>
                  <Input
                    value={portInputValue}
                    onChange={(e) => setPortInputValue(e.target.value)}
                    placeholder="3000"
                    className="w-full"
                  />
                </BlockItemContent>
              </BlockItem>
            </Block>
          )}
          <VariablesProvider
            teamId={teamId}
            projectId={projectId}
            environmentId={environmentId}
            serviceId={service.id}
            type="service"
          >
            <VariableReferencesProvider
              type="service"
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
            </VariableReferencesProvider>
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

type TStringOrNullState = [string | null, Dispatch<SetStateAction<string | null>>];

function Content({
  service,
  tagState,
  branchState,
  databaseVersionState,
}: {
  service: TServiceShallow;
  tagState: TStringOrNullState;
  branchState: TStringOrNullState;
  databaseVersionState: TStringOrNullState;
}) {
  if (service.config.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr?.[1] || "latest";

    if (!image || !tag) return <ErrorLine message="Image or tag is not found." />;

    return <UndeployedContentDockerImage image={image} tag={tag} tagState={tagState} />;
  }

  if (service.config.type === "github") {
    if (
      !service.git_repository_owner ||
      !service.git_repository ||
      !service.config.git_branch ||
      service.github_installation_id === undefined
    ) {
      return (
        <ErrorLine message="Git owner, repository, installation ID, or branch is not found." />
      );
    }

    return (
      <UndeployedContentGit
        owner={service.git_repository_owner}
        repo={service.git_repository}
        branch={service.config.git_branch}
        installationId={service.github_installation_id}
        branchState={branchState}
      />
    );
  }

  if (service.config.type === "database") {
    if (!service.config.database_type || !service.config.database_version) {
      return <ErrorLine message="Database type or version is not found." />;
    }

    return (
      <UndeployedContentDatabase
        type={service.config.database_type}
        versionState={databaseVersionState}
        version={service.config.database_version}
      />
    );
  }

  return <ErrorLine message="Service type is not supported." />;
}
