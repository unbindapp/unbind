import ErrorLine from "@/components/error-line";
import { getNetworkingEntityId } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import { TMode } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/types";
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
import { EthernetPortIcon, GlobeLockIcon, PlusIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { useMemo } from "react";
import { toast } from "sonner";

export default function AddDomainPortCard({
  service,
  isPending,
  mode = "public",
}: {
  isPending: boolean;
  service: TServiceShallow;
  mode?: TMode;
}) {
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
      host: "",
      targetPortType:
        service.config.ports.length >= 1 ? service.config.ports[0].port.toString() : "",
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
                    {mode === "public" && currentPorts.length !== 0 && (
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
                        selector={(s) => ({ isCustom: s.values.targetPortType === customPortText })}
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
