import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import {
  useServiceEndpoints,
  useServiceEndpointsUtils,
} from "@/components/service/service-endpoints-provider";
import { useService } from "@/components/service/service-provider";
import useUpdateService from "@/components/service/use-update-service";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { validateDomain } from "@/lib/helpers/validate-domain";
import { validatePort } from "@/lib/helpers/validate-port";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TExternalEndpoint, TServiceShallow } from "@/server/trpc/api/services/types";
import { useStore } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import {
  EthernetPortIcon,
  GlobeIcon,
  GlobeLockIcon,
  NetworkIcon,
  PenIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";

type TProps = {
  service: TServiceShallow;
};

export default function NetworkingSection({ service }: TProps) {
  if (service.type === "github") {
    if (
      !service.git_repository_owner ||
      !service.git_repository ||
      !service.config.git_branch ||
      service.github_installation_id === undefined
    ) {
      return (
        <ErrorWithWrapper message="Git owner, repository, installation ID, or branch is not found." />
      );
    }

    return <AllServiceTypesSection service={service} />;
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return <AllServiceTypesSection service={service} />;
  }

  if (service.type === "database") {
    if (!service.database_type || !service.database_version) {
      return <ErrorWithWrapper message="Database type or version is not found." />;
    }

    return <AllServiceTypesSection service={service} />;
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function AllServiceTypesSection({ service }: { service: TServiceShallow }) {
  const {
    query: { data: endpointsData, isPending: isPendingEndpoints, error: errorEndpoints },
  } = useServiceEndpoints();

  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  return (
    <SettingsSection
      title="Networking"
      id="networking"
      Icon={NetworkIcon}
      entityId={sectionHighlightId}
    >
      {(service.type === "github" || service.type === "docker-image") && (
        <Block>
          <BlockItem className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Public Networking</BlockItemTitle>
              <BlockItemDescription>
                Communicate with the service over the internet.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full flex-col gap-2">
                {!endpointsData && !isPendingEndpoints && errorEndpoints && (
                  <ErrorLine
                    message={errorEndpoints.message}
                    className="border-destructive/16 rounded-lg border py-2.5"
                  />
                )}
                {!endpointsData && isPendingEndpoints && (
                  <BlockItemButtonLike
                    isPending={true}
                    key="loading"
                    asElement="div"
                    text="loading.unbind"
                    Icon={({ className }: { className?: string }) => (
                      <GlobeLockIcon className={cn("scale-90", className)} />
                    )}
                  />
                )}
                {endpointsData?.endpoints &&
                  endpointsData.endpoints.external.map((endpoint) => (
                    <DomainPortCard
                      key={`${endpoint.host}:${endpoint.port.port}`}
                      endpoint={endpoint}
                      service={service}
                    />
                  ))}
                <AddDomainPortCard service={service} isPending={isPendingEndpoints} />
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle>Private Networking</BlockItemTitle>
            <BlockItemDescription>
              {"Communicate with the service from within the Unbind's network."}
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent>
            <div className="flex w-full flex-col gap-2">
              {!endpointsData && !isPendingEndpoints && errorEndpoints && (
                <ErrorLine
                  message={errorEndpoints.message}
                  className="border-destructive/16 rounded-lg border py-2.5"
                />
              )}
              {!endpointsData && isPendingEndpoints && (
                <BlockItemButtonLike
                  isPending={true}
                  key="loading"
                  asElement="div"
                  text="loading.unbind:3000"
                  Icon={({ className }: { className?: string }) => (
                    <GlobeLockIcon className={cn("scale-90", className)} />
                  )}
                />
              )}
              {endpointsData?.endpoints.internal?.flatMap((hostObject) =>
                hostObject.ports.map((portObject) => (
                  <BlockItemButtonLike
                    classNameText="whitespace-normal"
                    key={`${hostObject.dns}:${portObject.port}`}
                    asElement="div"
                    text={`${hostObject.dns}:${portObject.port}`}
                    Icon={({ className }: { className?: string }) => (
                      <GlobeLockIcon className={cn("scale-90", className)} />
                    )}
                    SuffixComponent={({ className }) => (
                      <div
                        className={cn(
                          "-my-2.5 -mr-3 flex items-start justify-end self-stretch p-1",
                          className,
                        )}
                      >
                        <CopyButton
                          className="size-8"
                          classNameIcon="size-4"
                          valueToCopy={`${hostObject.dns}:${portObject.port}`}
                        />
                        <DeleteButton
                          mode="private"
                          domain={hostObject.dns}
                          port={portObject.port}
                          service={service}
                        />
                      </div>
                    )}
                  />
                )),
              )}
              <AddDomainPortCard service={service} isPending={isPendingEndpoints} mode="private" />
            </div>
          </BlockItemContent>
        </BlockItem>
      </Block>
    </SettingsSection>
  );
}

function getDisplayUrl({ host, port }: { host: string; port: string }) {
  return `${host}${port ? `:${port}` : ""}`;
}

function DomainPortCard({
  endpoint,
  service,
}: {
  endpoint: TExternalEndpoint;
  service: TServiceShallow;
}) {
  /*  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  const {
    mutateAsync: updateService,
    isPending: isPendingUpdate,
    error: errorUpdate,
    reset: resetUpdate,
  } = useUpdateService({
    onSuccess: async () => {
      form.reset();
    },
    idToHighlight: sectionHighlightId,
  }); */

  const form = useAppForm({
    defaultValues: {
      host: endpoint.host,
      port: endpoint.port.port.toString(),
      isEditing: false,
    },
  });

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (!s.fieldMeta.host?.isDefaultValue) count++;
    if (!s.fieldMeta.port?.isDefaultValue) count++;
    return count;
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex w-full flex-col gap-2"
    >
      <form.Subscribe
        selector={(s) => ({
          isEditing: s.values.isEditing,
        })}
        children={({ isEditing }) => (
          <div
            data-editing={isEditing ? true : undefined}
            className="data-editing:border-process/25 group/field flex w-full flex-col overflow-hidden rounded-lg border"
          >
            <>
              <BlockItemButtonLike
                asElement="div"
                classNameText="whitespace-normal"
                className="group-data-editing/field:bg-process/8 group-data-editing/field:text-process border-none group-data-editing/field:rounded-b-none"
                text={getDisplayUrl({
                  host: endpoint.host,
                  port: "",
                })}
                Icon={({ className }: { className?: string }) => (
                  <GlobeIcon className={cn("scale-90", className)} />
                )}
                SuffixComponent={({ className }) => (
                  <div
                    className={cn(
                      "-my-2.5 -mr-3 flex items-start justify-end self-stretch p-1",
                      isEditing && "opacity-0",
                      className,
                    )}
                  >
                    <CopyButton
                      disabled={isEditing}
                      className="size-8"
                      classNameIcon="size-4"
                      valueToCopy={getDisplayUrl({
                        host: endpoint.host,
                        port: "",
                      })}
                    />
                    <Button
                      disabled={isEditing}
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-muted-more-foreground size-8 rounded-md"
                      onClick={() => {
                        form.setFieldValue("isEditing", true);
                      }}
                    >
                      <PenIcon className="size-4" />
                    </Button>
                    <DeleteButton
                      mode="public"
                      disabled={isEditing}
                      domain={endpoint.host}
                      port={endpoint.port.port}
                      service={service}
                    />
                  </div>
                )}
              />
              {isEditing && (
                <div className="border-process/25 flex w-full flex-col border-t">
                  <div className="flex w-full flex-col gap-4 px-3 pt-3 pb-3.25 sm:px-4.5 sm:pt-3.75 sm:pb-4.75">
                    <Block>
                      <form.AppField
                        name="host"
                        validators={{
                          onChange: ({ value }) => validateDomain({ value, isPublic: true }),
                        }}
                      >
                        {(field) => (
                          <BlockItem className="w-full md:w-full">
                            <BlockItemHeader type="column">
                              <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                                Domain
                              </BlockItemTitle>
                            </BlockItemHeader>
                            <BlockItemContent>
                              <field.DomainInput
                                field={field}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                }}
                                placeholder="example.com"
                                autoCapitalize="off"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck="false"
                                hideCard={field.state.meta.isDefaultValue}
                              />
                            </BlockItemContent>
                          </BlockItem>
                        )}
                      </form.AppField>
                    </Block>
                    <Block>
                      <form.AppField
                        name="port"
                        validators={{
                          onChange: ({ value }) => validatePort({ value, isPublic: true }),
                        }}
                      >
                        {(field) => (
                          <BlockItem className="w-full md:w-full">
                            <BlockItemHeader type="column">
                              <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                                Port
                              </BlockItemTitle>
                            </BlockItemHeader>
                            <BlockItemContent>
                              <field.TextField
                                field={field}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                }}
                                placeholder="3000"
                                autoCapitalize="off"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck="false"
                                inputMode="numeric"
                              />
                            </BlockItemContent>
                          </BlockItem>
                        )}
                      </form.AppField>
                    </Block>
                  </div>
                  <div className="bg-process/8 border-process/20 mt-1 flex w-full border-t p-1.5">
                    <div className="w-1/2 p-1.5">
                      <Button
                        variant="outline-process"
                        className="text-foreground has-hover:hover:text-foreground active:text-foreground w-full"
                        onClick={() => {
                          form.reset();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <div className="w-1/2 p-1.5">
                      <Button variant="process" className="w-full">
                        Apply{changeCount > 0 ? ` (${changeCount})` : ""}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          </div>
        )}
      />
    </form>
  );
}

function AddDomainPortCard({
  service,
  isPending,
  mode = "public",
}: {
  isPending: boolean;
  service: TServiceShallow;
  mode?: "public" | "private";
}) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { refetch: refetchServiceEndpoints } = useServiceEndpointsUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

  const {
    mutateAsync: updateService,
    isPending: isPendingUpdate,
    error: errorUpdate,
    reset: resetUpdate,
  } = useUpdateService({
    onSuccess: async () => {
      const result = await ResultAsync.fromPromise(
        refetchServiceEndpoints(),
        () => new Error("Failed to refetch service endpoints"),
      );
      if (result.isErr()) {
        toast.error("Failed to refetch service endpoints", {
          description:
            "Update was successful, but failed to refetch service endpoints. Please refresh the page.",
        });
      }
      form.reset();
    },
    idToHighlight: sectionHighlightId,
  });

  const customPortText = "Custom Port";

  const form = useAppForm({
    defaultValues: {
      host: "",
      portType: service.config.ports.length >= 1 ? service.config.ports[0].port.toString() : "",
      port: "",
      isEditing: false,
    },
    onSubmit: async ({ value }) => {
      const port =
        mode === "public"
          ? value.portType !== customPortText
            ? value.portType
            : value.port
          : value.port;
      await updateService({
        addHosts:
          mode === "public"
            ? [{ host: value.host, path: "", target_port: Number(port) }]
            : undefined,
        addPorts: service.config.ports.map((p) => p.port).includes(Number(port))
          ? undefined
          : [{ port: Number(port) }],
      });
    },
  });

  const currentPorts = useMemo(() => {
    return service.config.ports.map((portObject) => portObject.port.toString());
  }, [service.config.ports]);

  const portItems = useMemo(() => {
    return currentPorts
      ? [
          ...currentPorts.map((port) => ({
            value: port,
            label: port,
          })),
          { value: customPortText, label: customPortText },
        ]
      : undefined;
  }, [currentPorts]);

  return (
    <div className="flex w-full flex-col">
      <form.Subscribe
        selector={(s) => ({
          isEditing: s.values.isEditing,
        })}
        children={({ isEditing }) => (
          <>
            {!isEditing && (
              <form.AppField
                name="isEditing"
                children={(field) => (
                  <BlockItemButtonLike
                    type="button"
                    isPending={isPending}
                    key="add-external-endpoint"
                    asElement="button"
                    text={mode === "private" ? "Add private domain" : "Add domain"}
                    Icon={PlusIcon}
                    onClick={() => field.handleChange(true)}
                  />
                )}
              />
            )}
            {isEditing && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
                }}
                className="flex w-full flex-col rounded-lg border"
              >
                <div className="flex w-full flex-col gap-4 px-3 pt-3 pb-3.25 sm:px-4.5 sm:pt-3.5 sm:pb-4.75">
                  {mode === "public" && (
                    <Block>
                      <form.AppField
                        name="host"
                        validators={{
                          onChange: ({ value }) => validateDomain({ value, isPublic: true }),
                        }}
                      >
                        {(field) => (
                          <BlockItem className="w-full md:w-full">
                            <BlockItemHeader type="column">
                              <BlockItemTitle>Domain</BlockItemTitle>
                            </BlockItemHeader>
                            <BlockItemContent>
                              <field.DomainInput
                                field={field}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={(e) => {
                                  field.handleChange(e.target.value);
                                }}
                                placeholder="example.com"
                                autoCapitalize="off"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck="false"
                                hideCard={field.state.meta.isDefaultValue}
                              />
                            </BlockItemContent>
                          </BlockItem>
                        )}
                      </form.AppField>
                    </Block>
                  )}
                  <div className="flex w-full flex-col">
                    {(mode === "private" || currentPorts.length === 0) && (
                      <Block>
                        <form.AppField
                          name="port"
                          validators={{
                            onChange: ({ value }) => {
                              if (currentPorts.includes(value)) {
                                return { message: "This port already exists." };
                              }
                              return validatePort({ value, isPublic: true });
                            },
                          }}
                          children={(field) => (
                            <BlockItem className="w-full md:w-full">
                              <BlockItemHeader type="column">
                                <BlockItemTitle>Port</BlockItemTitle>
                              </BlockItemHeader>
                              <BlockItemContent>
                                <field.TextField
                                  field={field}
                                  value={field.state.value}
                                  onBlur={field.handleBlur}
                                  onChange={(e) => field.handleChange(e.target.value)}
                                  placeholder="3000"
                                  autoCapitalize="off"
                                  autoCorrect="off"
                                  autoComplete="off"
                                  spellCheck="false"
                                  inputMode="numeric"
                                />
                              </BlockItemContent>
                            </BlockItem>
                          )}
                        />
                      </Block>
                    )}
                    {mode === "public" && currentPorts.length !== 0 && (
                      <Block>
                        <form.AppField name="portType">
                          {(field) => (
                            <BlockItem className="w-full md:w-full">
                              <BlockItemHeader type="column">
                                <BlockItemTitle>Port</BlockItemTitle>
                              </BlockItemHeader>
                              <BlockItemContent>
                                <field.AsyncDropdownMenu
                                  dontCheckUntilSubmit
                                  field={field}
                                  value={field.state.value}
                                  onChange={(v) => field.handleChange(v)}
                                  items={portItems}
                                  isPending={false}
                                  error={undefined}
                                  classNameItem={({ value }) => {
                                    if (value === customPortText) {
                                      return "gap-1.5 text-muted-foreground";
                                    }
                                    return "gap-1.5";
                                  }}
                                  ItemIcon={({ value, className }) => {
                                    if (value === customPortText) {
                                      return <PlusIcon className={className} />;
                                    }
                                    return null;
                                  }}
                                >
                                  {({ isOpen }) => (
                                    <BlockItemButtonLike
                                      data-is-custom={
                                        field.state.value === customPortText ? true : undefined
                                      }
                                      className="data-is-custom:rounded-b-none data-is-custom:border-b-0"
                                      asElement="button"
                                      text={field.state.value}
                                      Icon={({ className }) => (
                                        <EthernetPortIcon className={cn("scale-90", className)} />
                                      )}
                                      variant="outline"
                                      open={isOpen}
                                      onBlur={field.handleBlur}
                                    />
                                  )}
                                </field.AsyncDropdownMenu>
                              </BlockItemContent>
                            </BlockItem>
                          )}
                        </form.AppField>
                      </Block>
                    )}
                    {mode === "private" && (
                      <div className="text-success bg-success/8 mt-2 flex justify-start gap-1.5 rounded-md px-3 py-2 text-sm">
                        <GlobeLockIcon className="mt-0.5 -ml-0.5 size-3.5 shrink-0" />
                        <p className="min-w-0 shrink leading-tight">
                          Private domain will be auto-generated.
                        </p>
                      </div>
                    )}
                    {mode === "public" && currentPorts.length !== 0 && (
                      <form.Subscribe
                        selector={(s) => ({ isCustom: s.values.portType === customPortText })}
                        children={({ isCustom }) => {
                          if (!isCustom) return null;
                          return (
                            <form.AppField
                              name="port"
                              validators={{
                                onChange: ({ value }) => validatePort({ value, isPublic: true }),
                              }}
                              children={(field) => (
                                <>
                                  <div className="bg-border h-px w-full" />
                                  <field.TextField
                                    field={field}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    classNameInput="rounded-t-none border-t-0"
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    placeholder="3000"
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    autoComplete="off"
                                    spellCheck="false"
                                    inputMode="numeric"
                                  />
                                </>
                              )}
                            />
                          );
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="flex w-full flex-col border-t p-1.5">
                  {errorUpdate && (
                    <div className="w-full p-1.5">
                      <ErrorLine message={errorUpdate.message} />
                    </div>
                  )}
                  <div className="flex w-full">
                    <div className="w-1/2 p-1.5">
                      <Button
                        className="w-full"
                        type="button"
                        aria-label="Cancel"
                        variant="outline"
                        onClick={() => {
                          form.reset();
                          resetUpdate();
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                    <div className="w-1/2 p-1.5">
                      <form.SubmitButton
                        isPending={isPending || isPendingUpdate}
                        className="w-full"
                      >
                        Add
                      </form.SubmitButton>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      />
    </div>
  );
}

function DeleteButton({
  domain,
  port,
  mode,
  disabled,
  service,
}: {
  domain: string;
  port: number;
  mode: "private" | "public";
  disabled?: boolean;
  service: TServiceShallow;
}) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { refetch: refetchEndpoints } = useServiceEndpointsUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });

  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);
  const { mutateAsync: updateService, refetch: refetchServices } = useUpdateService({
    idToHighlight: sectionHighlightId,
    manualRefetch: true,
  });

  const { mutateAsync: deleteDomainOrPort, error: errorDeleteDomainOrPort } = useMutation({
    mutationFn: async () => {
      if (mode === "public") {
        await updateService({
          removeHosts: [{ host: domain, path: "", target_port: port }],
        });
      } else if (mode === "private") {
        await updateService({
          removePorts: [{ port }],
        });
      }

      const result = await ResultAsync.fromPromise(
        Promise.all([refetchEndpoints(), refetchServices()]),
        () => new Error("Failed to refetch"),
      );

      if (result.isErr()) {
        toast.error("Failed to refetch", {
          description:
            "Update was successful, but failed to refetch service endpoints. Please refresh the page.",
        });
      }
    },
  });

  return (
    <DeleteEntityTrigger
      EntityNameBadge={() => (
        <p className="bg-foreground/6 border-foreground/6 -ml-0.5 max-w-[calc(100%+0.25rem)] rounded-md border px-1.5 font-mono font-semibold">
          {getDisplayUrl({ host: domain, port: mode === "public" ? "" : port.toString() })}
        </p>
      )}
      deletingEntityName={domain}
      dialogTitle={mode === "private" ? "Delete Private Domain" : "Delete Domain"}
      dialogDescription={
        mode === "private"
          ? "The port and all public domains using that port will be deleted. This action cannot be undone."
          : "Are you sure you want to delete this domain? This action cannot be undone."
      }
      onSubmit={deleteDomainOrPort}
      error={errorDeleteDomainOrPort}
      disableConfirmationInput
    >
      <Button
        type="button"
        size="icon"
        variant="ghost-destructive"
        className="text-muted-more-foreground size-8 rounded-md"
        disabled={disabled}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </DeleteEntityTrigger>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `networking-${service.id}`;
}
