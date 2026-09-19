import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import { TMode } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/types";
import { useStageNetworking } from "@/components/service/panel/content/deployed/settings/use-service-changes";
import type { TStagedListEntry } from "@/components/staged-changes/staged-changes-provider";
import { useSystem } from "@/components/system/system-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { generateDomain } from "@/lib/helpers/generate-domain";
import { validateDomain } from "@/lib/helpers/validate-domain";
import { validatePort } from "@/lib/helpers/validate-port";
import { useAppFormWithPersistence } from "@/lib/hooks/use-app-form-with-persistence";
import { TServiceShallow } from "@/lib/queries/services";
import {
  CheckCircleIcon,
  ChevronUpIcon,
  EthernetPortIcon,
  GlobeLockIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useStore } from "@tanstack/react-form";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

const maxGeneratedDomains = 100;
const customPortText = "Custom Port";

const DraftSchema = z.object({
  host: z.string(),
  targetPortType: z.string(),
  targetPort: z.string(),
  isEditing: z.boolean(),
});

export default function AddDomainPortCard({
  service,
  isPending,
  staged,
  mode = "public",
}: {
  isPending: boolean;
  service: TServiceShallow;
  staged: TStagedListEntry[];
  mode?: TMode;
}) {
  const { stageHost, stagePort } = useStageNetworking(service);

  const takenHosts = useMemo(() => {
    const hosts = new Set(service.config.hosts.map((h) => h.host));
    for (const change of staged) {
      if (change.kind === "host" && change.value) hosts.add(change.value.host);
    }
    return hosts;
  }, [service.config.hosts, staged]);

  const { data: systemData } = useSystem();
  const wildcardDomain = systemData?.data.system_settings.wildcard_domain;
  const nextGeneratedDomain = useMemo(() => {
    if (mode !== "public" || !wildcardDomain) return undefined;
    // The first seed is the one the service was created with, so a deleted domain
    // comes back identical, and every seed after it adds another one
    for (let i = 0; i < maxGeneratedDomains; i++) {
      const domain = generateDomain({
        name: service.name,
        wildcardDomain,
        seed: i === 0 ? service.id : `${service.id}:${i}`,
      });
      if (!takenHosts.has(domain)) return domain;
    }
    return undefined;
  }, [mode, wildcardDomain, service.name, service.id, takenHosts]);
  const [generatedDomain, setGeneratedDomain] = useState<string | undefined>(undefined);

  const defaultTargetPortType =
    service.config.ports.length >= 1
      ? service.config.ports[0].port.toString()
      : service.detected_ports.length >= 1
        ? service.detected_ports[0].port.toString()
        : "";

  const form = useAppFormWithPersistence({
    defaultValues: {
      host: "",
      targetPortType: defaultTargetPortType,
      targetPort: "",
      isEditing: false,
    },
    persistenceType: "session",
    persistenceKey: `add-domain:${service.id}:${mode}`,
    persistenceSchema: DraftSchema,
    onSubmit: async ({ value }) => {
      // The port select only renders for public domains with at least one known port
      const usesPortSelect =
        mode === "public" && allPortOptions.length >= 1 && value.targetPortType !== customPortText;
      const port = Number(usesPortSelect ? value.targetPortType : value.targetPort);

      if (mode === "public") stageHost(null, { host: value.host, port });
      if (mode === "private") stagePort(port, "add");
      form.reset();
      setGeneratedDomain(undefined);
    },
  });

  const currentPorts = useMemo(() => {
    const ports = service.config.ports.map((portObject) => portObject.port.toString());
    if (mode !== "private") return ports;
    const stagedPorts = staged.flatMap((change) =>
      change.kind === "port" && change.op === "add" ? [change.port.toString()] : [],
    );
    return [...ports, ...stagedPorts];
  }, [service.config.ports, staged, mode]);

  const allPortOptions = useMemo(() => {
    const allPorts = new Set([
      ...currentPorts,
      ...service.detected_ports.map((p) => p.port.toString()),
    ]);

    return Array.from(allPorts);
  }, [service.detected_ports, currentPorts]);

  // A restored draft can name a port the service no longer has
  const targetPortType = useStore(form.store, (s) => s.values.targetPortType);
  useEffect(() => {
    if (!targetPortType || targetPortType === customPortText) return;
    if (allPortOptions.includes(targetPortType)) return;
    form.setFieldValue("targetPortType", defaultTargetPortType);
  }, [targetPortType, allPortOptions, defaultTargetPortType, form]);

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

  return (
    <div className="flex w-full flex-col">
      <form.Subscribe
        selector={(s) => ({
          isEditing: s.values.isEditing,
        })}
        children={({ isEditing }) => (
          <>
            <form.AppField
              name="isEditing"
              children={(field) => (
                <BlockItemButtonLike
                  type="button"
                  isEditing={isEditing}
                  isPending={isPending}
                  asElement="button"
                  text={mode === "private" ? "Add private domain" : "Add domain"}
                  Icon={PlusOrChevron}
                  className="touch-manipulation data-editing:rounded-b-none"
                  onClick={() => field.handleChange(!field.state.value)}
                />
              )}
            />
            {isEditing && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit(e);
                }}
                className="flex w-full flex-col rounded-lg rounded-t-none border border-t-0"
              >
                <div className="flex w-full flex-col gap-4 px-3 pt-3 pb-3.25 sm:px-4.5 sm:pt-3.5 sm:pb-4.75">
                  {mode === "public" && (
                    <Block>
                      <form.AppField
                        name="host"
                        validators={{
                          onChange: ({ value }) => {
                            if (takenHosts.has(value)) {
                              return { message: "This domain already exists." };
                            }
                            return validateDomain({ value, isPublic: true });
                          },
                        }}
                      >
                        {(field) => {
                          const isGeneratedDomain = field.state.value === generatedDomain;
                          return (
                            <BlockItem className="w-full md:w-full">
                              <BlockItemHeader className="justify-between">
                                <BlockItemTitle>Domain</BlockItemTitle>
                                {nextGeneratedDomain && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={isGeneratedDomain}
                                    onClick={() => {
                                      setGeneratedDomain(nextGeneratedDomain);
                                      field.handleChange(nextGeneratedDomain);
                                    }}
                                    data-generated={isGeneratedDomain || undefined}
                                    className="text-muted-foreground group/button -my-1.5 max-w-1/2 min-w-0 gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium wrap-break-word"
                                  >
                                    <RefreshCwIcon className="size-3.5 shrink-0 transition group-data-generated/button:rotate-90" />
                                    <span className="min-w-0 shrink truncate">Generate</span>
                                  </Button>
                                )}
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
                                  autoGeneratedDomain={generatedDomain}
                                  hideCard={field.state.meta.isDefaultValue}
                                />
                              </BlockItemContent>
                            </BlockItem>
                          );
                        }}
                      </form.AppField>
                    </Block>
                  )}
                  <div className="flex w-full flex-col">
                    {(mode === "private" || allPortOptions.length === 0) && (
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
                    {mode === "private" && (
                      <div className="text-success bg-success/3-10 mt-2 flex justify-start gap-1.5 rounded-md px-3 py-2 text-sm leading-tight">
                        <div className="line-icon">
                          <GlobeLockIcon className="-ml-0.5 size-3.5 shrink-0" />
                        </div>
                        <p className="min-w-0 shrink">
                          The private domain will be generated based on the port.
                        </p>
                      </div>
                    )}
                    {mode === "public" && allPortOptions.length >= 1 && (
                      <Block>
                        <form.AppField
                          name="targetPortType"
                          validators={{
                            onChange: ({ value }) => {
                              if (value === customPortText) return undefined;
                              return validatePort({ value, isPublic: true });
                            },
                          }}
                        >
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
                                  ItemSuffix={({ value, className }) => {
                                    if (detectedPortsMap[value] === undefined) {
                                      return null;
                                    }
                                    return (
                                      <div
                                        className={cn(
                                          "text-success bg-success/3-10 border-success/4-10 py-0.375 -my-0.5 flex min-w-0 shrink items-center gap-1.5 rounded-full border px-1.75 text-sm leading-tight",
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
                                        field.state.value === customPortText || undefined
                                      }
                                      className="data-is-custom:rounded-b-none data-is-custom:border-b-0"
                                      asElement="button"
                                      text={field.state.value}
                                      Icon={({ className }) => (
                                        <EthernetPortIcon className={className} />
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
                    {mode === "public" && allPortOptions.length >= 1 && (
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
                  <div className="flex w-full">
                    <div className="w-1/2 p-1.5">
                      <Button
                        type="button"
                        className="w-full"
                        aria-label="Cancel"
                        variant="outline"
                        onClick={() => {
                          form.reset();
                          setGeneratedDomain(undefined);
                        }}
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

function PlusOrChevron({ className, isEditing }: { className?: string; isEditing?: boolean }) {
  return (
    <div
      data-editing={isEditing || undefined}
      className={cn(
        className,
        "group/div relative size-5 shrink-0 transition-transform data-editing:rotate-45",
      )}
    >
      <ChevronUpIcon className="size-full -rotate-45 opacity-0 group-data-editing/div:opacity-100" />
      <PlusIcon className="absolute top-0 left-0 size-full group-data-editing/div:opacity-0" />
    </div>
  );
}
