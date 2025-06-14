import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import useUpdateService, {
  TUpdateServiceInputSimple,
} from "@/components/service/use-update-service";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { HealthCheckTypeSchema } from "@/server/go/client.gen";
import { THealthCheckType, TServiceShallow } from "@/server/trpc/api/services/types";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { useStore } from "@tanstack/react-form";
import {
  CircleSlashIcon,
  EthernetPortIcon,
  GlobeIcon,
  HeartIcon,
  TerminalSquareIcon,
} from "lucide-react";
import { ReactNode, useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

export default function HealthSection({ service }: TProps) {
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

    return <GitOrDockerImageSection service={service} />;
  }

  if (service.type === "docker-image") {
    const arr = service.config.image?.split(":");
    const image = arr?.[0];
    const tag = arr && arr.length > 1 ? arr?.[1] : "latest";

    if (!image || !tag) return <ErrorWithWrapper message="Image or tag is not found." />;

    return <GitOrDockerImageSection service={service} />;
  }

  return <ErrorWithWrapper message="Unsupported service type" />;
}

function GitOrDockerImageSection({ service }: { service: TServiceShallow }) {
  const healthCheckTypeFromService = service.config.health_check?.type || "none";

  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);

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
  });

  const form = useAppForm({
    defaultValues: {
      healthCheckType: healthCheckTypeFromService,
      healthCheckEndpoint: service.config.health_check?.path || "",
      healthCheckEndpointPort: service.config.ports?.[0]?.port?.toString() || "",
      healthCheckCommand: service.config.health_check?.command || "",
      healthCheckIntervalSeconds:
        service.config.health_check?.health_period_seconds?.toString() || "",
      healthCheckFailureThreshold:
        service.config.health_check?.health_failure_threshold?.toString() || "",
      startupCheckIntervalSeconds:
        service.config.health_check?.startup_period_seconds?.toString() || "",
      startupCheckFailureThreshold:
        service.config.health_check?.startup_failure_threshold?.toString() || "",
    },
    onSubmit: async ({ formApi, value }) => {
      let hasChanged = false;
      const changes: TUpdateServiceInputSimple = {};

      if (formApi.getFieldMeta("healthCheckType")?.isDefaultValue === false) {
        changes.healthCheckType = value.healthCheckType;
        hasChanged = true;
      }
      if (
        formApi.getFieldMeta("healthCheckEndpoint")?.isDefaultValue === false &&
        changes.healthCheckType === "http"
      ) {
        changes.healthCheckEndpoint = value.healthCheckEndpoint;
        hasChanged = true;
      }
      if (
        formApi.getFieldMeta("healthCheckEndpointPort")?.isDefaultValue === false &&
        changes.healthCheckType === "http"
      ) {
        changes.healthCheckEndpointPort =
          value.healthCheckEndpointPort === ""
            ? undefined
            : parseInt(value.healthCheckEndpointPort);
        hasChanged = true;
      }
      if (
        formApi.getFieldMeta("healthCheckCommand")?.isDefaultValue === false &&
        changes.healthCheckType === "exec"
      ) {
        changes.healthCheckCommand = value.healthCheckCommand;
        hasChanged = true;
      }
      if (formApi.getFieldMeta("healthCheckIntervalSeconds")?.isDefaultValue === false) {
        changes.healthCheckIntervalSeconds =
          value.healthCheckIntervalSeconds === "" ? -1 : Number(value.healthCheckIntervalSeconds);
        changes.healthCheckType = value.healthCheckType;
        hasChanged = true;
      }
      if (formApi.getFieldMeta("healthCheckFailureThreshold")?.isDefaultValue === false) {
        changes.healthCheckFailureThreshold =
          value.healthCheckFailureThreshold === "" ? -1 : Number(value.healthCheckFailureThreshold);
        changes.healthCheckType = value.healthCheckType;
        hasChanged = true;
      }
      if (formApi.getFieldMeta("startupCheckIntervalSeconds")?.isDefaultValue === false) {
        changes.startupCheckIntervalSeconds =
          value.startupCheckIntervalSeconds === "" ? -1 : Number(value.startupCheckIntervalSeconds);
        changes.healthCheckType = value.healthCheckType;
        hasChanged = true;
      }
      if (formApi.getFieldMeta("startupCheckFailureThreshold")?.isDefaultValue === false) {
        changes.startupCheckFailureThreshold =
          value.startupCheckIntervalSeconds === ""
            ? -1
            : Number(value.startupCheckFailureThreshold);
        changes.healthCheckType = value.healthCheckType;
        hasChanged = true;
      }

      if (hasChanged) {
        await updateService(changes);
      } else {
        form.reset();
      }
    },
  });

  const portItems = useMemo(() => {
    return service.config.ports?.map((port) => ({
      label: port.port.toString(),
      value: port.port.toString(),
    }));
  }, [service]);

  const healthCheckItems = useMemo(() => {
    return HealthCheckTypeSchema.options
      .filter((o) => (portItems === undefined || portItems.length < 1 ? o !== "http" : true))
      .map((o) => ({
        label: healthCheckTypeToName(o),
        value: o,
      }));
  }, [portItems]);

  const changeCount = useStore(form.store, (s) => {
    const meta = s.fieldMeta;
    const values = s.values;
    let count = 0;
    if (values.healthCheckType === "exec") {
      if (meta.healthCheckCommand?.isDefaultValue === false) {
        count++;
      }
    }
    if (values.healthCheckType === "http") {
      if (meta.healthCheckEndpoint?.isDefaultValue === false) {
        count++;
      }
      if (meta.healthCheckEndpointPort?.isDefaultValue === false) count++;
    }
    if (meta.healthCheckType?.isDefaultValue === false) count++;
    if (values.healthCheckType !== "none") {
      if (meta.healthCheckFailureThreshold?.isDefaultValue === false) count++;
      if (meta.healthCheckIntervalSeconds?.isDefaultValue === false) count++;
      if (meta.startupCheckIntervalSeconds?.isDefaultValue === false) count++;
      if (meta.startupCheckFailureThreshold?.isDefaultValue === false) count++;
    }
    return count;
  });

  const healthCheckType = useStore(form.store, (s) => s.values.healthCheckType);

  const hasChanges = useStore(form.store, (s) => {
    const meta = s.fieldMeta;
    const values = s.values;

    if (meta.healthCheckType?.isDefaultValue === true) return false;
    if (values.healthCheckType === "exec") {
      if (meta.healthCheckCommand?.isDefaultValue === false) return true;
    }
    if (values.healthCheckType === "http") {
      if (meta.healthCheckEndpoint?.isDefaultValue === false) return true;
      if (meta.healthCheckEndpointPort?.isDefaultValue === false) return true;
    }
    if (values.healthCheckType !== "none") {
      if (meta.healthCheckIntervalSeconds?.isDefaultValue === false) return true;
      if (meta.healthCheckFailureThreshold?.isDefaultValue === false) return true;
      if (meta.startupCheckIntervalSeconds?.isDefaultValue === false) return true;
      if (meta.startupCheckFailureThreshold?.isDefaultValue === false) return true;
    }
    return false;
  });

  return (
    <SettingsSection
      asElement="form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit(e);
      }}
      title="Health"
      id="health"
      Icon={HeartIcon}
      changeCount={changeCount}
      onClickResetChanges={() => {
        form.reset();
        resetUpdate();
      }}
      SubmitButton={form.SubmitButton}
      isPending={isPendingUpdate}
      error={errorUpdate?.message}
      entityId={sectionHighlightId}
    >
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle hasChanges={hasChanges}>Health Check Type</BlockItemTitle>
            <BlockItemDescription>
              The type of health check to decide if a deployment is healthy.
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent className="gap-0">
            <form.AppField
              name="healthCheckType"
              children={(field) => (
                <field.AsyncDropdownMenu
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v as THealthCheckType)}
                  items={healthCheckItems}
                  ItemIcon={({ className, value }) => (
                    <HealthCheckIcon className={cn("scale-90", className)} type={value} />
                  )}
                  isPending={false}
                  error={undefined}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      data-not-none={field.state.value !== "none" ? true : undefined}
                      className="data-not-none:rounded-b-none data-not-none:border-b-0"
                      text={healthCheckTypeToName(field.state.value)}
                      Icon={({ className }) => (
                        <HealthCheckIcon
                          type={field.state.value}
                          className={cn("scale-90", className)}
                        />
                      )}
                      variant="outline"
                      open={isOpen}
                      onBlur={field.handleBlur}
                    />
                  )}
                </field.AsyncDropdownMenu>
              )}
            />
            {healthCheckType !== "none" && <div className="bg-border -mt-1 h-px w-full" />}
            {healthCheckType === "http" && portItems && (
              <div className="relative -mt-1 w-full">
                <form.AppField
                  name="healthCheckEndpoint"
                  validators={{
                    onChange: ({ value }) => {
                      if (healthCheckType === "http") {
                        return validateHealthCheckEndpoint(value);
                      }
                      return undefined;
                    },
                  }}
                  children={(field) => (
                    <field.TextField
                      classNameInput="rounded-t-none border-t-0 pr-27"
                      field={field}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      placeholder="/health"
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  )}
                />
                <form.AppField
                  name="healthCheckEndpointPort"
                  children={(field) => (
                    <field.AsyncDropdownMenu
                      dontCheckUntilSubmit
                      field={field}
                      value={field.state.value}
                      onChange={(v) => field.handleChange(v)}
                      items={portItems}
                      isPending={false}
                      error={undefined}
                      classNameDropdownContent="w-auto"
                      dropdownTitle="Port"
                      dropdownMenuContentAlign="end"
                    >
                      {({ isOpen }) => (
                        <BlockItemButtonLike
                          className="absolute top-1 right-1.25 z-10 w-24 gap-1 rounded-md px-2 py-1.5 font-mono text-sm"
                          asElement="button"
                          text={field.state.value}
                          Icon={({ className }) => (
                            <EthernetPortIcon className={cn(className, "size-4.5 scale-90")} />
                          )}
                          variant="outline"
                          open={isOpen}
                          onBlur={field.handleBlur}
                          classNameChevron="size-4"
                        />
                      )}
                    </field.AsyncDropdownMenu>
                  )}
                />
              </div>
            )}
            {healthCheckType === "exec" && (
              <form.AppField
                name="healthCheckCommand"
                validators={{
                  onChange: ({ value }) => {
                    if (healthCheckType === "exec") {
                      return validateHealthCheckCommand(value);
                    }
                    return undefined;
                  },
                }}
                children={(field) => (
                  <field.TextField
                    className="-mt-1"
                    classNameInput="rounded-t-none border-t-0"
                    field={field}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      field.handleChange(e.target.value);
                    }}
                    placeholder="test -f /app/ready.txt"
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck="false"
                  />
                )}
              />
            )}
          </BlockItemContent>
        </BlockItem>
      </Block>
      {healthCheckType !== "none" && (
        <Block>
          <BlockItem className="group/item w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Health Check</BlockItemTitle>
              <BlockItemDescription>
                The health check interval in seconds and the number of tries before considering the
                service unhealthy.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full gap-3">
                <form.AppField
                  name="healthCheckIntervalSeconds"
                  validators={{
                    onChange: ({ value }) => validateInterval(value),
                  }}
                  children={(field) => (
                    <MiniSection
                      title="Interval"
                      unit="sec"
                      hasChanges={field.state.meta.isDefaultValue === false}
                    >
                      <field.TextField
                        field={field}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        placeholder="10"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                        inputMode="numeric"
                        className="min-w-0 flex-1"
                        classNameInput="rounded-r-none"
                      />
                    </MiniSection>
                  )}
                />
                <form.AppField
                  name="healthCheckFailureThreshold"
                  validators={{
                    onChange: ({ value }) => validateFailureThreshold(value),
                  }}
                  children={(field) => (
                    <MiniSection
                      title="Try"
                      unit="times"
                      hasChanges={field.state.meta.isDefaultValue === false}
                    >
                      <field.TextField
                        field={field}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        placeholder="3"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                        inputMode="numeric"
                        className="min-w-0 flex-1"
                        classNameInput="rounded-r-none"
                      />
                    </MiniSection>
                  )}
                />
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      {healthCheckType !== "none" && (
        <Block>
          <BlockItem className="group/item w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Startup Check</BlockItemTitle>
              <BlockItemDescription>
                The startup check interval in seconds and the number of tries before considering the
                service unhealthy during startup.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full gap-3">
                <form.AppField
                  name="startupCheckIntervalSeconds"
                  validators={{
                    onChange: ({ value }) => validateInterval(value),
                  }}
                  children={(field) => (
                    <MiniSection
                      title="Interval"
                      unit="sec"
                      hasChanges={field.state.meta.isDefaultValue === false}
                    >
                      <field.TextField
                        field={field}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        placeholder="3"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                        inputMode="numeric"
                        className="min-w-0 flex-1"
                        classNameInput="rounded-r-none"
                      />
                    </MiniSection>
                  )}
                />
                <form.AppField
                  name="startupCheckFailureThreshold"
                  validators={{
                    onChange: ({ value }) => validateFailureThreshold(value),
                  }}
                  children={(field) => (
                    <MiniSection
                      title="Try"
                      unit="times"
                      hasChanges={field.state.meta.isDefaultValue === false}
                    >
                      <field.TextField
                        field={field}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        placeholder="30"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                        inputMode="numeric"
                        className="min-w-0 flex-1"
                        classNameInput="rounded-r-none"
                      />
                    </MiniSection>
                  )}
                />
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
    </SettingsSection>
  );
}

function MiniSection({
  title,
  unit,
  hasChanges,
  children,
}: {
  title: string;
  unit: string;
  hasChanges?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      data-changed={hasChanges ? true : undefined}
      className="group/div flex flex-1 flex-col gap-2"
    >
      <p className="group-data-changed/div:text-process px-1.5 leading-tight font-medium">
        {title}
      </p>
      <div className="flex w-full items-start">
        {children}
        <div className="bg-background-hover text-muted-foreground flex h-10.5 min-w-0 shrink items-center justify-end rounded-r-lg border border-l-0 px-2.5 text-right text-sm leading-tight font-medium">
          <p className="min-w-0 shrink">{unit}</p>
        </div>
      </div>
    </div>
  );
}

function HealthCheckIcon({
  type,
  className,
}: {
  type: THealthCheckType | (string & {});
  className?: string;
}) {
  if (type === "exec") return <TerminalSquareIcon className={className} />;
  if (type === "http") return <GlobeIcon className={className} />;
  if (type === "none") return <CircleSlashIcon className={className} />;
  return <QuestionMarkCircledIcon className={className} />;
}

function healthCheckTypeToName(type: THealthCheckType | (string & {})) {
  if (type === "http") return "Endpoint";
  if (type === "exec") return "Command";
  if (type === "none") return "None";
  return "Unknown";
}

function getEntityId(service: TServiceShallow): string {
  return `health-${service.id}`;
}

function validateHealthCheckEndpoint(value: string) {
  if (value === undefined || value.trim() === "") {
    return {
      message: "Endpoint is required.",
    };
  }
  if (typeof value !== "string") {
    return {
      message: "Endpoint must be a string.",
    };
  }
  return undefined;
}

function validateHealthCheckCommand(value: string) {
  if (value === undefined || value.trim() === "") {
    return {
      message: "Command is required.",
    };
  }
  if (typeof value !== "string") {
    return {
      message: "Command must be a string.",
    };
  }
  return undefined;
}

function validateInterval(value: string) {
  if (value === undefined || value === "") {
    return undefined;
  }
  const num = Number(value);
  if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    return {
      message: "Must be a positive integer.",
    };
  }
  return undefined;
}

function validateFailureThreshold(value: string) {
  if (value === undefined || value === "") {
    return undefined;
  }
  const num = Number(value);
  if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
    return {
      message: "Must be a positive integer.",
    };
  }
  return undefined;
}
