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
import { useServiceEndpoints } from "@/components/service/service-endpoints-provider";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { validateDomain } from "@/lib/helpers/validate-domain";
import { validatePort } from "@/lib/helpers/validate-port";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TExternalEndpoint, TServiceShallow } from "@/server/trpc/api/services/types";
import { useStore } from "@tanstack/react-form";
import {
  EthernetPortIcon,
  GlobeIcon,
  GlobeLockIcon,
  HourglassIcon,
  NetworkIcon,
  PenIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo } from "react";

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

  return (
    <SettingsSection title="Networking" id="networking" Icon={NetworkIcon}>
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
                      </div>
                    )}
                  />
                )),
              )}
              {endpointsData?.endpoints.internal?.flatMap((hostObject) => hostObject.ports)
                .length === 0 && (
                <BlockItemButtonLike
                  classNameText="whitespace-normal text-muted-foreground"
                  asElement="div"
                  text={`Waiting for deployment...`}
                  Icon={({ className }: { className?: string }) => (
                    <HourglassIcon
                      className={cn("animate-hourglass text-muted-foreground scale-90", className)}
                    />
                  )}
                />
              )}
            </div>
          </BlockItemContent>
        </BlockItem>
      </Block>
    </SettingsSection>
  );
}

function getDisplayUrlExternal(endpoint: { host: string; port: string }) {
  return `${endpoint.host}${endpoint.port !== "443" && endpoint.port ? `:${endpoint.port}` : ""}`;
}

function DomainPortCard({ endpoint }: { endpoint: TExternalEndpoint }) {
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
                text={getDisplayUrlExternal({
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
                      valueToCopy={getDisplayUrlExternal({
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
                    <Button
                      disabled={isEditing}
                      type="button"
                      size="icon"
                      variant="ghost-destructive"
                      className="text-muted-more-foreground size-8 rounded-md"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
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
}: {
  isPending: boolean;
  service: TServiceShallow;
}) {
  const customPortText = "Custom Port";

  const form = useAppForm({
    defaultValues: {
      host: "",
      portType: service.config.ports?.[0]?.port.toString() || "",
      port: "",
      isEditing: false,
    },
  });

  const currentPorts = useMemo(() => {
    return service.config.ports?.map((portObject) => portObject.port.toString());
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
                    text="Add domain"
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
                  <div className="flex w-full flex-col">
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
                                    className="data-is-custom:rounded-b-none"
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
                              <field.TextField
                                field={field}
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                className="-mt-px"
                                classNameInput="rounded-t-none"
                                onChange={(e) => field.handleChange(e.target.value)}
                                placeholder="3000"
                                autoCapitalize="off"
                                autoCorrect="off"
                                autoComplete="off"
                                spellCheck="false"
                                inputMode="numeric"
                              />
                            )}
                          />
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="flex w-full flex-col border-t p-1.5">
                  <div className="flex w-full">
                    <div className="w-1/2 p-1.5">
                      <Button
                        className="w-full"
                        type="button"
                        aria-label="Cancel"
                        variant="outline"
                        onClick={() => form.reset()}
                      >
                        Cancel
                      </Button>
                    </div>
                    <div className="w-1/2 p-1.5">
                      <form.SubmitButton isPending={isPending} className="w-full">
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
