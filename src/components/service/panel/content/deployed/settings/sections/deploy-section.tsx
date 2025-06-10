import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/service/panel/content/undeployed/block";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { SettingsSection } from "@/components/settings/settings-section";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { HealthCheckTypeSchema } from "@/server/go/client.gen";
import { THealthCheckType, TServiceShallow } from "@/server/trpc/api/services/types";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { useStore } from "@tanstack/react-form";
import { CircleSlashIcon, GlobeIcon, RocketIcon, TerminalSquareIcon } from "lucide-react";
import { toast } from "sonner";

type TProps = {
  service: TServiceShallow;
};

export default function DeploySection({ service }: TProps) {
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

const cpuLimits = {
  min: 200,
  max: 16000,
  step: 200,
  unlimited: 16200,
};

const memoryLimits = {
  min: 200,
  max: 16000,
  step: 200,
  unlimited: 16200,
};

function GitOrDockerImageSection({ service }: { service: TServiceShallow }) {
  const healthCheckTypeFromService = service.config.health_check?.type || "none";

  const form = useAppForm({
    defaultValues: {
      instanceCount: service.config.replicas,
      cpuMillicores: cpuLimits.unlimited,
      memoryMb: memoryLimits.unlimited,
      healthCheckEndpoint: service.config.health_check?.path || "",
      healthCheckCommand: service.config.health_check?.command || "",
      healthCheckType: healthCheckTypeFromService,
    },
    onSubmit: () => {
      toast.success("Changes saved successfully.", {
        description: "This is fake",
        duration: 5000,
      });
    },
  });

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (s.values.healthCheckType === "exec") {
      if (s.fieldMeta.healthCheckCommand?.isDefaultValue === false) {
        count++;
      }
    }
    if (s.values.healthCheckType === "http") {
      if (s.fieldMeta.healthCheckEndpoint?.isDefaultValue === false) {
        count++;
      }
    }
    if (s.fieldMeta.instanceCount?.isDefaultValue === false) count++;
    if (s.fieldMeta.cpuMillicores?.isDefaultValue === false) count++;
    if (s.fieldMeta.memoryMb?.isDefaultValue === false) count++;
    if (s.fieldMeta.healthCheckType?.isDefaultValue === false) count++;
    return count;
  });

  return (
    <SettingsSection
      asElement="form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      title="Deploy"
      id="deploy"
      Icon={RocketIcon}
      changeCount={changeCount}
      onClickResetChanges={() => form.reset()}
      /* SubmitButton={form.SubmitButton} */
    >
      <Block>
        <form.AppField
          name="instanceCount"
          children={(field) => (
            <BlockItem className="group/item w-full md:w-full">
              <BlockItemHeader className="group-data-changed/item:text-process" type="column">
                <BlockItemTitle hasChanges={!field.state.meta.isDefaultValue}>
                  Instances
                </BlockItemTitle>
                <BlockItemDescription>
                  The number of instances/replicas to run for this service.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <div className="flex w-full flex-col rounded-lg border pb-1.5">
                  <ValueTitle
                    title="Instances"
                    value={field.state.value ? field.state.value.toString() : "1"}
                  />
                  <field.StorageSizeInput
                    field={field}
                    className="w-full px-3.5 py-3"
                    onBlur={field.handleBlur}
                    min={1}
                    max={10}
                    step={1}
                    hideMinMax
                    defaultValue={[service.config.replicas]}
                    value={field.state.value ? [field.state.value] : undefined}
                    onValueChange={(value) => {
                      field.handleChange(value[0]);
                    }}
                  />
                </div>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
      <Block>
        <form.Subscribe
          selector={(s) => ({
            hasChanges:
              s.fieldMeta.cpuMillicores?.isDefaultValue === false ||
              s.fieldMeta.memoryMb?.isDefaultValue === false,
          })}
          children={({ hasChanges }) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={hasChanges}>Resource Limits</BlockItemTitle>
                <BlockItemDescription>
                  The maximum vCPU and memory to allocate for each instance.
                </BlockItemDescription>
              </BlockItemHeader>
              <BlockItemContent>
                <div className="flex w-full flex-col rounded-lg border">
                  <form.AppField
                    name="cpuMillicores"
                    children={(field) => (
                      <div className="flex w-full flex-col pb-1.5">
                        <ValueTitle title="vCPU" value={cpuFormatter(field.state.value)} />
                        <field.StorageSizeInput
                          field={field}
                          className="w-full px-3.5 py-3"
                          onBlur={field.handleBlur}
                          min={cpuLimits.min}
                          max={cpuLimits.unlimited}
                          step={cpuLimits.step}
                          hideMinMax
                          defaultValue={[
                            service.config.resources?.cpu_limits_millicores || cpuLimits.unlimited,
                          ]}
                          value={field.state.value ? [field.state.value] : undefined}
                          onValueChange={(value) => {
                            field.handleChange(value[0]);
                          }}
                        />
                      </div>
                    )}
                  />
                  <div className="bg-border h-px w-full" />
                  <form.AppField
                    name="memoryMb"
                    children={(field) => (
                      <div className="flex w-full flex-col pb-1.5">
                        <ValueTitle title="Memory" value={memoryFormatter(field.state.value)} />
                        <field.StorageSizeInput
                          field={field}
                          className="w-full px-3.5 py-3"
                          onBlur={field.handleBlur}
                          min={memoryLimits.min}
                          max={memoryLimits.unlimited}
                          step={memoryLimits.step}
                          hideMinMax
                          defaultValue={[
                            service.config.resources?.memory_limits_megabytes ||
                              memoryLimits.unlimited,
                          ]}
                          value={field.state.value ? [field.state.value] : undefined}
                          onValueChange={(value) => {
                            field.handleChange(value[0]);
                          }}
                        />
                      </div>
                    )}
                  />
                </div>
              </BlockItemContent>
            </BlockItem>
          )}
        />
      </Block>
      <Block>
        <form.Subscribe
          selector={(s) => ({
            healthCheckType: s.values.healthCheckType,
            hasChanges:
              s.fieldMeta.healthCheckType?.isDefaultValue === false ||
              (s.values.healthCheckType === "exec" &&
                s.fieldMeta.healthCheckCommand?.isDefaultValue === false) ||
              (s.values.healthCheckType === "http" &&
                s.fieldMeta.healthCheckEndpoint?.isDefaultValue === false),
          })}
          children={({ healthCheckType, hasChanges }) => (
            <BlockItem className="w-full md:w-full">
              <BlockItemHeader type="column">
                <BlockItemTitle hasChanges={hasChanges}>Health Check</BlockItemTitle>
                <BlockItemDescription>
                  The endpoint to call or the command to execute to decide if a new deployment is
                  ready.
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
                      items={HealthCheckTypeSchema.options.map((o) => ({
                        label: healthCheckTypeToName(o),
                        value: o,
                      }))}
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
                {healthCheckType === "http" && (
                  <form.AppField
                    name="healthCheckEndpoint"
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
                        placeholder="/health"
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                      />
                    )}
                  />
                )}
                {healthCheckType === "exec" && (
                  <form.AppField
                    name="healthCheckCommand"
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
          )}
        />
      </Block>
    </SettingsSection>
  );
}

function cpuFormatter(millicores: number) {
  if (millicores > cpuLimits.max) return "Unlimited";
  const cpu = Math.round((millicores / 1000) * 100) / 100;
  return cpu.toFixed(1);
}

function memoryFormatter(mb: number) {
  if (mb > memoryLimits.max) return "Unlimited";
  return `${(Math.round((mb / 1000) * 100) / 100).toFixed(1)} GB`;
}

function ValueTitle({
  title,
  value,
  className,
}: {
  title: string;
  value: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground w-full px-3.5 pt-2.5 pb-1 leading-tight font-medium",
        className,
      )}
    >
      <span className="pr-[0.6ch]">{title}:</span>
      <span className="text-foreground font-mono font-bold">{value}</span>
    </p>
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
