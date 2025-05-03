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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import CreateVariablesForm, {
  TCreateVariablesFormResult,
} from "@/components/variables/create-variables-form";
import VariableReferencesProvider from "@/components/variables/variable-references-provider";
import VariablesProvider, { useVariablesUtils } from "@/components/variables/variables-provider";
import { TServiceShallow, TUpdateServiceInput } from "@/server/trpc/api/services/types";
import { TS3SourceShallow } from "@/server/trpc/api/storage/s3/types";
import {
  TVariableForCreate,
  TVariableReferenceForCreate,
  VariableForCreateSchema,
  VariableReferenceForCreateSchema,
} from "@/server/trpc/api/variables/types";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { CheckCircleIcon, CircleSlashIcon, EyeOffIcon, LoaderIcon } from "lucide-react";
import { Dispatch, HTMLAttributes, SetStateAction, useRef, useState } from "react";

type TProps = {
  service: TServiceShallow;
  className?: string;
} & HTMLAttributes<HTMLDivElement>;

export default function ServicePanelContentUndeployed({ service, className, ...rest }: TProps) {
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
  const { refetch: refetchVariables } = useVariablesUtils({
    teamId,
    projectId,
    environmentId,
    serviceId: service.id,
    type: "service",
  });

  const createVariablesFormResult = useRef<TCreateVariablesFormResult>({
    variables: [],
    variableReferences: [],
  });

  const { mutateAsync: createDeployment } = api.deployments.create.useMutation();
  const { mutateAsync: upsertVariables } = api.variables.createOrUpdate.useMutation();
  const { mutateAsync: updateService } = api.services.update.useMutation();

  const tagState = useState<string | null>(null);
  const branchState = useState<string | null>(null);
  const databaseVersionState = useState<string | null>(null);
  const databaseBackupSourceState = useState<TDatabaseBackupSource | null>(null);

  const [isPrivateService, setIsPrivateService] = useState<boolean>(!service.config.is_public);

  const privateServiceText = "Private service";

  const [domain, setDomain] = useState<string>("");

  const port =
    service.config.ports && service.config.ports?.length > 0 ? service.config.ports[0].port : null;
  const [portInputValue, setPortInputValue] = useState<string>(port?.toString() || "");

  const {
    mutate: createFirstDeployment,
    isPending: createFirstDeploymentIsPending,
    error: createFirstDeploymentError,
  } = useMutation({
    mutationFn: async () => {
      const parsedRegularVariables: TVariableForCreate[] = [];
      const parsedVariableReferences: TVariableReferenceForCreate[] = [];

      for (const variable of createVariablesFormResult.current.variables) {
        const { success, data } = VariableForCreateSchema.safeParse(variable);
        if (success) {
          parsedRegularVariables.push(data);
        }
      }

      for (const variableReference of createVariablesFormResult.current.variableReferences) {
        const { success, data } = VariableReferenceForCreateSchema.safeParse(variableReference);
        if (success) {
          parsedVariableReferences.push(data);
        }
      }

      if (parsedRegularVariables.length > 0 || parsedVariableReferences.length > 0) {
        await upsertVariables({
          teamId,
          projectId,
          environmentId,
          serviceId: service.id,
          variables: parsedRegularVariables,
          variableReferences: parsedVariableReferences,
          type: "service",
        });
      }

      const sharedServiceProps = {
        teamId,
        projectId,
        environmentId,
        serviceId: service.id,
      };

      const portChanged = portInputValue && portInputValue !== port?.toString() ? true : false;
      const currentDomain =
        service.config.hosts && service.config.hosts.length > 0
          ? service.config.hosts[0].host
          : null;
      const domainChanged = domain && domain !== currentDomain ? true : false;

      // Git service change
      const newBranch = branchState[0];
      if (service.type === "github") {
        const hasChange =
          service.config.git_branch !== newBranch ||
          service.config.is_public !== !isPrivateService ||
          portChanged ||
          domainChanged;

        if (hasChange) {
          const props: TUpdateServiceInput = {
            ...sharedServiceProps,
          };
          if (newBranch !== null && service.config.git_branch !== newBranch) {
            props.gitBranch = newBranch;
          }
          if (service.config.is_public !== !isPrivateService) {
            props.isPublic = !isPrivateService;
          }
          if (portChanged) {
            props.ports = [{ port: parseInt(portInputValue) }];
          }
          if (domainChanged) {
            props.hosts = [{ host: domain, path: "" }];
          }
          await updateService(props);
        }
      }

      // Docker service change
      if (service.type === "docker-image") {
        const arr = service.config.image?.split(":");
        const image = arr?.[0];
        const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

        const newTag = tagState[0];

        const hasChange =
          tag !== newTag ||
          service.config.is_public !== !isPrivateService ||
          portChanged ||
          domainChanged;

        if (image !== undefined && hasChange) {
          const props: TUpdateServiceInput = {
            ...sharedServiceProps,
          };
          if (newTag !== null && tag !== newTag) {
            props.image = `${image}:${newTag}`;
          }
          if (service.config.is_public !== !isPrivateService) {
            props.isPublic = !isPrivateService;
          }
          if (portChanged) {
            props.ports = [{ port: parseInt(portInputValue) }];
          }
          if (domainChanged) {
            props.hosts = [{ host: domain, path: "" }];
          }
          await updateService(props);
        }
      }

      // Database service change
      const newDatabaseVersion = databaseVersionState[0];
      if (service.type === "database" && service.database_version !== newDatabaseVersion) {
        const props: TUpdateServiceInput = {
          ...sharedServiceProps,
        };
        if (newDatabaseVersion !== null && service.database_version !== newDatabaseVersion) {
          props.databaseConfig = {
            version: newDatabaseVersion,
          };
        }
        const backupSource = databaseBackupSourceState[0];
        if (backupSource !== null) {
          props.s3BackupSourceId = backupSource.source.id;
          props.s3BackupBucket = backupSource.bucket;
        }
        await updateService(props);
      }

      await createDeployment({
        teamId,
        projectId,
        environmentId,
        serviceId: service.id,
      });

      await refetchDeployments();

      const promises = [refetchService(), refetchServices()];
      if (parsedRegularVariables.length > 0 || parsedVariableReferences.length > 0) {
        promises.push(refetchVariables());
      }
      await Promise.all(promises);
    },
  });

  const isServicePublicable = service.type === "github" || service.type === "docker-image";

  return (
    <div
      className={cn("mt-4 flex w-full flex-1 flex-col overflow-hidden border-t sm:mt-6", className)}
      {...rest}
    >
      <ScrollArea classNameViewport="pb-8">
        <div className="flex w-full flex-1 flex-col gap-6 px-3 py-4 sm:p-6">
          <Content
            service={service}
            tagState={tagState}
            branchState={branchState}
            databaseVersionState={databaseVersionState}
            databaseBackupSourceState={databaseBackupSourceState}
          />
          {isServicePublicable && (
            <Block>
              <BlockItem>
                <BlockItemHeader>
                  <BlockItemTitle>Domain</BlockItemTitle>
                  <Button
                    variant="ghost"
                    onClick={() => setIsPrivateService((prev) => !prev)}
                    data-private={isPrivateService ? true : undefined}
                    className="group/button has-hover:hover:bg-border -my-1 -mr-0.5 ml-auto flex cursor-pointer items-center justify-center gap-2.5 rounded-full py-1 pr-1 pl-2.5 font-medium"
                  >
                    <p className="text-muted-foreground group-data-private/button:text-foreground has-hover:group-hover/button:text-foreground min-w-0 shrink">
                      Private
                    </p>
                    <div className="bg-muted-more-foreground group-data-private/button:bg-foreground relative h-5 w-9 rounded-full transition">
                      <div className="bg-background absolute top-0.5 left-0.5 size-4 rounded-full transition group-data-private/button:translate-x-4" />
                    </div>
                  </Button>
                </BlockItemHeader>
                <BlockItemContent>
                  <div className="flex w-full flex-col items-start">
                    <div
                      data-private={isPrivateService ? true : undefined}
                      className="group/input relative z-10 w-full"
                    >
                      <Input
                        disabled={isPrivateService}
                        value={isPrivateService ? privateServiceText : domain}
                        onChange={(e) => setDomain(e.currentTarget.value)}
                        placeholder="example.com"
                        className="w-full group-data-private/input:pl-9.5"
                      />
                      {isPrivateService && (
                        <EyeOffIcon className="text-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 scale-90 opacity-50" />
                      )}
                    </div>
                    {!isPrivateService && (
                      <DomainCard domain={domain} className="-mt-3 rounded-t-none pt-2.75" />
                    )}
                  </div>
                </BlockItemContent>
              </BlockItem>
              <BlockItem>
                <BlockItemHeader>
                  <BlockItemTitle>Port</BlockItemTitle>
                  {!isPrivateService && (
                    <div
                      data-detected={port !== null ? true : undefined}
                      className="bg-warning/10 text-warning border-warning/10 data-detected:text-success data-detected:bg-success/10 data-detected:border-success/10 -my-1 ml-auto flex min-w-0 shrink items-center justify-start gap-1.5 rounded-full border px-2 py-0.5"
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
                  )}
                </BlockItemHeader>
                <BlockItemContent>
                  <div
                    data-private={isPrivateService ? true : undefined}
                    className="group/input relative w-full"
                  >
                    <Input
                      disabled={isPrivateService}
                      value={!isPrivateService ? portInputValue : privateServiceText}
                      onChange={(e) => setPortInputValue(e.target.value)}
                      placeholder="3000"
                      className="w-full group-data-private/input:pl-9.5"
                    />
                    {isPrivateService && (
                      <EyeOffIcon className="text-foreground pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 scale-90 opacity-50" />
                    )}
                  </div>
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
                onValueChange={(v) => {
                  createVariablesFormResult.current = v;
                }}
              />
            </VariableReferencesProvider>
          </VariablesProvider>
        </div>
      </ScrollArea>
      <div className="flex w-full flex-col gap-2 border-t px-3 pt-3 pb-[calc(var(--safe-area-inset-bottom)+0.75rem)] sm:px-6 sm:pt-6 sm:pb-[calc(var(--safe-area-inset-bottom)+1.5rem)]">
        {createFirstDeploymentError && <ErrorLine message={createFirstDeploymentError.message} />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (createFirstDeploymentIsPending) return;
            createFirstDeployment();
          }}
        >
          <Button
            data-pending={createFirstDeploymentIsPending ? true : undefined}
            className="group/button data-pending:bg-foreground/60 w-full"
            disabled={createFirstDeploymentIsPending}
            fadeOnDisabled={false}
          >
            {createFirstDeploymentIsPending && (
              <div className="absolute top-0 left-0 h-full w-full items-center justify-center overflow-hidden rounded-lg">
                <div className="from-foreground/0 via-foreground to-foreground/0 animate-ping-pong absolute top-1/2 left-1/2 aspect-square w-[100%] origin-center -translate-1/2 bg-gradient-to-r" />
              </div>
            )}
            <div className="relative flex w-full items-center justify-center gap-1.5">
              {createFirstDeploymentIsPending && (
                <LoaderIcon className="-my-1 -ml-0.5 size-5 shrink-0 animate-spin" />
              )}
              <p className="min-w-0 shrink">
                {createFirstDeploymentIsPending ? "Deploying" : "Deploy"}
              </p>
            </div>
          </Button>
        </form>
      </div>
    </div>
  );
}

function Content({
  service,
  tagState,
  branchState,
  databaseVersionState,
  databaseBackupSourceState,
}: {
  service: TServiceShallow;
  tagState: TStringOrNullState;
  branchState: TStringOrNullState;
  databaseVersionState: TStringOrNullState;
  databaseBackupSourceState: TDatabaseBackupSourceState;
}) {
  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorLine message="Image or tag is not found." />;

    return <UndeployedContentDockerImage image={image} tag={tag} tagState={tagState} />;
  }

  if (service.type === "github") {
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

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorLine message="Database type or version is not found." />;
    }

    return (
      <UndeployedContentDatabase
        type={service.database_type}
        versionState={databaseVersionState}
        version={service.database_version}
        backupSourceState={databaseBackupSourceState}
      />
    );
  }

  return <ErrorLine message="Service type is not supported." />;
}

type TStringOrNullState = [string | null, Dispatch<SetStateAction<string | null>>];

export type TDatabaseBackupSource = { bucket: string; source: TS3SourceShallow };
export type TDatabaseBackupSourceState = [
  TDatabaseBackupSource | null,
  Dispatch<SetStateAction<TDatabaseBackupSource | null>>,
];
