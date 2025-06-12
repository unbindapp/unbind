import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import DeleteButton from "@/components/service/panel/content/deployed/settings/sections/networking/_components/delete-button";
import {
  getNetworkingDisplayUrl,
  getNetworkingEntityId,
} from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import { TModeAndPort } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/types";
import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import { useServiceEndpointsUtils } from "@/components/service/service-endpoints-provider";
import { useService } from "@/components/service/service-provider";
import useUpdateService from "@/components/service/use-update-service";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { validateDomain } from "@/lib/helpers/validate-domain";
import { validatePort } from "@/lib/helpers/validate-port";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/server/trpc/api/services/types";
import { useStore } from "@tanstack/react-form";
import {
  CheckCircleIcon,
  EthernetPortIcon,
  GlobeIcon,
  GlobeLockIcon,
  PenIcon,
  PlusIcon,
} from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";

export default function DomainPortCard({
  mode,
  domain,
  port,
  service,
}: {
  service: TServiceShallow;
  domain: string;
} & TModeAndPort) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const { refetch: refetchServiceEndpoints } = useServiceEndpointsUtils({
    teamId,
    projectId,
    environmentId,
    serviceId,
  });
  const sectionHighlightId = useMemo(() => getNetworkingEntityId(service), [service]);

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
      host: domain,
      targetPortType:
        service.config.ports.length >= 1
          ? service.config.ports[0].port.toString()
          : service.detected_ports.length >= 1
            ? service.detected_ports[0].port.toString()
            : "",
      targetPort: "",
      isEditing: false,
    },
    onSubmit: async ({ value }) => {
      const port =
        mode === "public" && value.targetPortType !== customPortText
          ? value.targetPortType
          : value.targetPort;

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

  const allPortOptions = useMemo(() => {
    const allPorts = new Set([
      ...currentPorts,
      ...service.detected_ports.map((p) => p.port.toString()),
    ]);

    return Array.from(allPorts);
  }, [service.detected_ports, currentPorts]);

  const detectedPortsMap = useMemo(() => {
    const obj: Record<string, number> = {};
    service.detected_ports.forEach((p) => {
      obj[p.port.toString()] = p.port;
    });
    return obj;
  }, [service.detected_ports]);

  const portItems: { value: string; label: string }[] | undefined = useMemo(() => {
    return allPortOptions.length >= 1
      ? [
          ...allPortOptions.map((p) => ({
            value: p,
            label: p,
          })),
          { value: customPortText, label: customPortText },
        ]
      : undefined;
  }, [allPortOptions]);

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (!s.fieldMeta.host?.isDefaultValue) count++;
    if (!s.fieldMeta.targetPort?.isDefaultValue) count++;
    return count;
  });

  const deleteButtonExtraProps: TModeAndPort =
    mode === "private" ? { mode: "private", port } : { mode: "public", port };

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
                text={getNetworkingDisplayUrl({
                  host: domain,
                  port: mode === "public" ? "" : port.toString(),
                })}
                Icon={({ className }: { className?: string }) =>
                  mode === "private" ? (
                    <GlobeLockIcon className={cn("scale-90", className)} />
                  ) : (
                    <GlobeIcon className={cn("scale-90", className)} />
                  )
                }
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
                      valueToCopy={getNetworkingDisplayUrl({
                        host: domain,
                        port: mode === "public" ? "" : port.toString(),
                      })}
                    />
                    {mode === "public" && (
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
                    )}
                    {service.type !== "database" && (
                      <DeleteButton
                        {...deleteButtonExtraProps}
                        disabled={isEditing}
                        domain={domain}
                        service={service}
                      />
                    )}
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
                    <div className="flex w-full flex-col">
                      {allPortOptions.length === 0 && (
                        <Block>
                          <form.AppField
                            name="targetPort"
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
                                  <BlockItemTitle>Target Port</BlockItemTitle>
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
                      {allPortOptions.length !== 0 && (
                        <Block>
                          <form.AppField name="targetPortType">
                            {(field) => (
                              <BlockItem className="w-full md:w-full">
                                <BlockItemHeader type="column">
                                  <BlockItemTitle>Target Port</BlockItemTitle>
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
                                    ItemSuffix={({ value, className }) => {
                                      if (detectedPortsMap[value] === undefined) {
                                        return null;
                                      }
                                      return (
                                        <div
                                          className={cn(
                                            "text-success bg-success/8 border-success/12 py-0.375 -my-0.5 flex min-w-0 shrink items-center gap-1.5 rounded-full border px-1.75 text-sm leading-tight",
                                            className,
                                          )}
                                        >
                                          <CheckCircleIcon className="-ml-0.75 size-3.5 shrink-0" />
                                          <p className="min-w-0 shrink">Detected</p>
                                        </div>
                                      );
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
                      {allPortOptions.length >= 1 && (
                        <form.Subscribe
                          selector={(s) => ({
                            isCustom: s.values.targetPortType === customPortText,
                          })}
                          children={({ isCustom }) => {
                            if (!isCustom) return null;
                            return (
                              <form.AppField
                                name="targetPort"
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
                  <div className="bg-process/8 border-process/20 mt-1 flex w-full flex-col border-t p-1.5">
                    {errorUpdate && (
                      <div className="w-full p-1.5">
                        <ErrorLine message={errorUpdate.message} />
                      </div>
                    )}
                    <form.Subscribe
                      selector={(s) => ({
                        isSubmitting: s.isSubmitting,
                      })}
                      children={({ isSubmitting }) => (
                        <div className="flex w-full">
                          <div className="w-1/2 p-1.5">
                            <Button
                              variant="outline-process"
                              className="text-foreground has-hover:hover:text-foreground active:text-foreground w-full"
                              onClick={() => {
                                form.reset();
                                resetUpdate();
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                          <div className="w-1/2 p-1.5">
                            <Button
                              isPending={isSubmitting || isPendingUpdate}
                              variant="process"
                              className="w-full"
                            >
                              Apply{changeCount >= 1 ? ` (${changeCount})` : ""}
                            </Button>
                          </div>
                        </div>
                      )}
                    />
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
