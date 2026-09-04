import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import type { TServiceChangeField } from "@/components/changes/types";
import {
  stagedNumber,
  stagedString,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { HealthCheckTypeSchema } from "@/lib/server/client.gen";
import { THealthCheckType, TServiceShallow } from "@/lib/queries/services";
import { CircleHelpIcon } from "lucide-react";
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

// The API resets a threshold to its default when it gets a value below 1
const defaultApiValue = -1;

type TThresholdField = Extract<
  TServiceChangeField,
  | "healthCheckIntervalSeconds"
  | "healthCheckFailureThreshold"
  | "startupCheckIntervalSeconds"
  | "startupCheckFailureThreshold"
>;

const thresholdFields: Record<
  TThresholdField,
  { label: string; title: string; unit: string; placeholder: string }
> = {
  startupCheckIntervalSeconds: {
    label: "Startup check interval",
    title: "Try every",
    unit: "seconds",
    placeholder: "3",
  },
  startupCheckFailureThreshold: {
    label: "Startup check failures",
    title: "Restart after",
    unit: "errors",
    placeholder: "30",
  },
  healthCheckIntervalSeconds: {
    label: "Health check interval",
    title: "Check every",
    unit: "seconds",
    placeholder: "10",
  },
  healthCheckFailureThreshold: {
    label: "Health check failures",
    title: "Restart after",
    unit: "errors",
    placeholder: "3",
  },
};

const detailFields: TServiceChangeField[] = [
  "healthCheckEndpoint",
  "healthCheckEndpointPort",
  "healthCheckCommand",
  "healthCheckIntervalSeconds",
  "healthCheckFailureThreshold",
  "startupCheckIntervalSeconds",
  "startupCheckFailureThreshold",
];

function thresholdToInput(value: number) {
  return value === defaultApiValue ? "" : value.toString();
}

function thresholdToApi(value: string) {
  return value === "" ? defaultApiValue : Number(value);
}

function GitOrDockerImageSection({ service }: { service: TServiceShallow }) {
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);
  const { staged, stage, unstage } = useServiceChanges(service);

  const healthCheck = service.config.health_check;
  const serverType: THealthCheckType = healthCheck?.type || "none";
  const serverEndpoint = healthCheck?.path || "";
  const serverPort = healthCheck?.port ?? service.config.ports?.[0]?.port ?? defaultApiValue;
  const serverCommand = healthCheck?.command || "";
  const serverThresholds: Record<TThresholdField, number> = {
    healthCheckIntervalSeconds: healthCheck?.health_period_seconds ?? defaultApiValue,
    healthCheckFailureThreshold: healthCheck?.health_failure_threshold ?? defaultApiValue,
    startupCheckIntervalSeconds: healthCheck?.startup_period_seconds ?? defaultApiValue,
    startupCheckFailureThreshold: healthCheck?.startup_failure_threshold ?? defaultApiValue,
  };

  const form = useAppForm({
    defaultValues: {
      healthCheckType: stagedString(staged.healthCheckType, serverType) as THealthCheckType,
      healthCheckEndpoint: stagedString(staged.healthCheckEndpoint, serverEndpoint),
      healthCheckEndpointPort: thresholdToInput(
        stagedNumber(staged.healthCheckEndpointPort, serverPort),
      ),
      healthCheckCommand: stagedString(staged.healthCheckCommand, serverCommand),
      healthCheckIntervalSeconds: thresholdToInput(
        stagedNumber(
          staged.healthCheckIntervalSeconds,
          serverThresholds.healthCheckIntervalSeconds,
        ),
      ),
      healthCheckFailureThreshold: thresholdToInput(
        stagedNumber(
          staged.healthCheckFailureThreshold,
          serverThresholds.healthCheckFailureThreshold,
        ),
      ),
      startupCheckIntervalSeconds: thresholdToInput(
        stagedNumber(
          staged.startupCheckIntervalSeconds,
          serverThresholds.startupCheckIntervalSeconds,
        ),
      ),
      startupCheckFailureThreshold: thresholdToInput(
        stagedNumber(
          staged.startupCheckFailureThreshold,
          serverThresholds.startupCheckFailureThreshold,
        ),
      ),
    },
  });
  useResetFormOnStagedChange(form, staged, ["healthCheckType", ...detailFields]);

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

  const healthCheckType = useStore(form.store, (s) => s.values.healthCheckType);

  const stageThreshold = (field: TThresholdField, value: string) =>
    stage({
      field,
      label: thresholdFields[field].label,
      value: thresholdToApi(value),
      previous: serverThresholds[field],
      format: (v) => (v === defaultApiValue ? "Default" : `${v} ${thresholdFields[field].unit}`),
    });

  const thresholdInput = (field: TThresholdField) => (
    <form.AppField
      name={field}
      validators={{
        onChange: ({ value }) => validatePositiveInteger(value),
      }}
      children={(fieldApi) => (
        <MiniSection
          title={thresholdFields[field].title}
          unit={thresholdFields[field].unit}
          hasChanges={staged[field] !== undefined}
        >
          <fieldApi.TextField
            field={fieldApi}
            value={fieldApi.state.value}
            onBlur={() => {
              fieldApi.handleBlur();
              if (fieldApi.state.meta.errors.length > 0) return;
              stageThreshold(field, fieldApi.state.value);
            }}
            onChange={(e) => {
              fieldApi.handleChange(e.target.value);
            }}
            placeholder={thresholdFields[field].placeholder}
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
  );

  return (
    <SettingsSection title="Health" id="health" Icon={HeartIcon} entityId={sectionHighlightId}>
      <Block>
        <BlockItem className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle
              hasChanges={
                staged.healthCheckType !== undefined ||
                staged.healthCheckEndpoint !== undefined ||
                staged.healthCheckEndpointPort !== undefined ||
                staged.healthCheckCommand !== undefined
              }
            >
              Health Check Type
            </BlockItemTitle>
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
                  onChange={(v) => {
                    const type = v as THealthCheckType;
                    field.handleChange(type);
                    stage({
                      field: "healthCheckType",
                      label: "Health check type",
                      value: type,
                      previous: serverType,
                      format: healthCheckTypeToName,
                    });
                    // Turning checks off makes the other health settings meaningless
                    if (type === "none") unstage(detailFields);
                  }}
                  items={healthCheckItems}
                  ItemIcon={({ className, value }) => (
                    <HealthCheckIcon className={cn(className, "size-4.5")} type={value} />
                  )}
                  isPending={false}
                  error={undefined}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      data-not-none={field.state.value !== "none" || undefined}
                      className="data-not-none:rounded-b-none data-not-none:border-b-0"
                      text={healthCheckTypeToName(field.state.value)}
                      Icon={({ className }) => (
                        <HealthCheckIcon
                          type={field.state.value}
                          className={cn(className, "size-4.5")}
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
                      onBlur={() => {
                        field.handleBlur();
                        if (field.state.meta.errors.length > 0) return;
                        stage({
                          field: "healthCheckEndpoint",
                          label: "Health check endpoint",
                          value: field.state.value,
                          previous: serverEndpoint,
                        });
                      }}
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
                      onChange={(v) => {
                        field.handleChange(v);
                        stage({
                          field: "healthCheckEndpointPort",
                          label: "Health check port",
                          value: parseInt(v),
                          previous: serverPort,
                        });
                      }}
                      items={portItems}
                      isPending={false}
                      error={undefined}
                      classNameDropdownContent="w-auto"
                      dropdownTitle="Port"
                      dropdownMenuContentAlign="end"
                    >
                      {({ isOpen }) => (
                        <BlockItemButtonLike
                          className="bg-background absolute top-1 right-1.25 z-10 w-24 gap-1 rounded-md px-2 py-1.5 font-mono text-sm"
                          asElement="button"
                          text={field.state.value}
                          Icon={({ className }) => (
                            <EthernetPortIcon className={cn(className, "size-4")} />
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
                    onBlur={() => {
                      field.handleBlur();
                      if (field.state.meta.errors.length > 0) return;
                      stage({
                        field: "healthCheckCommand",
                        label: "Health check command",
                        value: field.state.value,
                        previous: serverCommand,
                      });
                    }}
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
              <BlockItemTitle>Startup Check</BlockItemTitle>
              <BlockItemDescription>
                Instances are activated after one successful check.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full gap-3 pt-0.5">
                {thresholdInput("startupCheckIntervalSeconds")}
                {thresholdInput("startupCheckFailureThreshold")}
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      {healthCheckType !== "none" && (
        <Block>
          <BlockItem className="group/item w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle>Health Check</BlockItemTitle>
              <BlockItemDescription>
                Monitor active instances and restart them if they are unhealthy.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full gap-3 pt-0.5">
                {thresholdInput("healthCheckIntervalSeconds")}
                {thresholdInput("healthCheckFailureThreshold")}
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
    <div data-changed={hasChanges || undefined} className="group/div flex flex-1 flex-col gap-2">
      <p className="group-data-changed/div:text-change px-1.5 leading-tight font-medium">{title}</p>
      <div className="flex w-full items-start">
        {children}
        <div className="bg-input text-muted-foreground flex h-10.5 min-w-0 shrink items-center justify-end rounded-r-lg border border-l-0 px-2.5 text-right text-sm leading-tight font-medium">
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
  return <CircleHelpIcon className={className} />;
}

function healthCheckTypeToName(type: THealthCheckType | (string & {})) {
  if (type === "http") return "Endpoint";
  if (type === "exec") return "Command";
  if (type === "none") return "None";
  return "Unknown";
}

function getEntityId(service: TServiceShallow): string {
  return `health_${service.id}`;
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

function validatePositiveInteger(value: string) {
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
