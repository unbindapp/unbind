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
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { useStore } from "@tanstack/react-form";
import { GlobeIcon, GlobeLockIcon, NetworkIcon, PenIcon, PlusIcon, Trash2Icon } from "lucide-react";

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

  const form = useAppForm({
    defaultValues: {
      externalEndpoints:
        endpointsData?.endpoints.external.map((e) => ({
          host: e.host,
          port: e.port.port.toString(),
          isEditing: false,
        })) || [],
    },
  });

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    s.values.externalEndpoints.forEach((endpoint, index) => {
      if (endpoint.host !== endpointsData?.endpoints.external[index]?.host) {
        count++;
      }
      if (endpoint.port !== endpointsData?.endpoints.external[index]?.port.port.toString()) {
        count++;
      }
    });
    return count;
  });

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
                {endpointsData?.endpoints && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      form.handleSubmit();
                    }}
                    className="flex w-full flex-col gap-2"
                  >
                    <form.AppField name="externalEndpoints" mode="array">
                      {(field) =>
                        field.state.value.map((value, index) => (
                          <div
                            data-editing={value.isEditing ? true : undefined}
                            key={value.host + value.port}
                            className="data-editing:border-process/25 group/field flex w-full flex-col rounded-lg border"
                          >
                            <form.Subscribe
                              selector={(s) => ({
                                isEditing: s.values.externalEndpoints[index].isEditing,
                              })}
                              children={({ isEditing }) => (
                                <>
                                  {endpointsData.endpoints.external[index] && (
                                    <BlockItemButtonLike
                                      asElement="div"
                                      classNameText="whitespace-normal"
                                      className="group-data-editing/field:bg-process/8 group-data-editing/field:text-process border-none group-data-editing/field:rounded-b-none"
                                      key={
                                        endpointsData.endpoints.external[index].host +
                                        endpointsData.endpoints.external[index].port.port
                                      }
                                      text={getDisplayUrlExternal({
                                        host: endpointsData.endpoints.external[index].host,
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
                                              host: endpointsData.endpoints.external[index].host,
                                              port: endpointsData.endpoints.external[
                                                index
                                              ].port.port.toString(),
                                            })}
                                          />
                                          <Button
                                            disabled={isEditing}
                                            type="button"
                                            size="icon"
                                            variant="ghost"
                                            className="text-muted-more-foreground size-8 rounded-md"
                                            onClick={() => {
                                              field.state.value.forEach((_, i) =>
                                                form.setFieldValue(
                                                  `externalEndpoints[${i}].isEditing`,
                                                  false,
                                                ),
                                              );
                                              form.setFieldValue(
                                                `externalEndpoints[${index}].isEditing`,
                                                true,
                                              );
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
                                  )}
                                  {isEditing && (
                                    <div className="border-process/25 flex w-full flex-col gap-4 border-t px-3 pt-2.5 pb-3 sm:px-4 sm:pt-3 sm:pb-4">
                                      <div className="flex w-full flex-col gap-1.5">
                                        <h4 className="max-w-full px-1.5 font-semibold">Domain</h4>
                                        <form.AppField
                                          name={`externalEndpoints[${index}].host`}
                                          validators={{
                                            onChange: ({ value }) =>
                                              validateDomain({ value, isPublic: true }),
                                          }}
                                        >
                                          {(subField) => (
                                            <field.DomainInput
                                              field={subField}
                                              value={subField.state.value}
                                              onBlur={subField.handleBlur}
                                              onChange={(e) => {
                                                subField.handleChange(e.target.value);
                                              }}
                                              placeholder="example.com"
                                              autoCapitalize="off"
                                              autoCorrect="off"
                                              autoComplete="off"
                                              spellCheck="false"
                                              hideCard={
                                                endpointsData.endpoints.external[index].host ===
                                                  field.state.value[index].host &&
                                                endpointsData.endpoints.external[
                                                  index
                                                ].port.port.toString() ===
                                                  field.state.value[index].port
                                              }
                                            />
                                          )}
                                        </form.AppField>
                                      </div>
                                      <div className="flex w-full flex-col gap-1.5">
                                        <h4 className="max-w-full px-1.5 font-semibold">Port</h4>
                                        <form.AppField
                                          name={`externalEndpoints[${index}].port`}
                                          validators={{
                                            onChange: ({ value }) =>
                                              validatePort({ value, isPublic: false }),
                                          }}
                                        >
                                          {(subField) => (
                                            <field.TextField
                                              field={subField}
                                              value={subField.state.value}
                                              onBlur={subField.handleBlur}
                                              onChange={(e) => {
                                                subField.handleChange(e.target.value);
                                              }}
                                              placeholder="3000"
                                              autoCapitalize="off"
                                              autoCorrect="off"
                                              autoComplete="off"
                                              spellCheck="false"
                                              inputMode="numeric"
                                            />
                                          )}
                                        </form.AppField>
                                      </div>
                                      <div className="mt-1 flex w-full">
                                        <div className="w-1/2 pr-1.5">
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
                                        <div className="w-1/2 pl-1.5">
                                          <Button
                                            disabled={changeCount < 1}
                                            variant="process"
                                            className="w-full"
                                          >
                                            Apply{changeCount > 0 ? ` (${changeCount})` : ""}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            />
                          </div>
                        ))
                      }
                    </form.AppField>
                  </form>
                )}
                <BlockItemButtonLike
                  type="button"
                  isPending={isPendingEndpoints}
                  key="add-external-endpoint"
                  asElement="button"
                  text="Add domain"
                  Icon={PlusIcon}
                />
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
