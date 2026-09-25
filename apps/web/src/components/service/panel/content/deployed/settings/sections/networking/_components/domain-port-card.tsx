import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import CopyButton from "@/components/copy-button";
import { getNetworkingDisplayUrl } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/helpers";
import { TModeAndPort } from "@/components/service/panel/content/deployed/settings/sections/networking/_components/types";
import { useStageNetworking } from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { DomainStatusRow } from "@/components/service/panel/content/undeployed/domain-card";
import { StagedChip, type TStagedState } from "@/components/staged-changes/staged-chip";
import type { TStagedListEntry } from "@/components/staged-changes/staged-changes-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { validateDomain } from "@/lib/helpers/validate-domain";
import { validatePort } from "@/lib/helpers/validate-port";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/lib/queries/services";
import { DNSStatus } from "@/lib/server/client.gen";
import { useStore } from "@tanstack/react-form";
import {
  CheckCircleIcon,
  CircleAlertIcon,
  EthernetPortIcon,
  GlobeIcon,
  GlobeLockIcon,
  PenIcon,
  PlusIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { useCallback, useMemo } from "react";

export default function DomainPortCard({
  mode,
  domain,
  port,
  service,
  dnsStatus,
  isCloudflare,
  staged,
}: {
  service: TServiceShallow;
  // What the card shows: the staged domain and port when there are any, the saved ones otherwise
  domain: string;
  dnsStatus?: DNSStatus;
  isCloudflare?: boolean;
  staged?: TStagedListEntry;
} & TModeAndPort) {
  const { stageHost, stagePort, discard } = useStageNetworking(service);
  const stagedHost = staged?.kind === "host" ? staged : undefined;
  const saved = stagedHost ? stagedHost.previous : { host: domain, port };
  const stagedState = getStagedState(staged);
  const isApplying = staged?.isApplying === true;

  const customPortText = "Custom Port";

  const currentPorts = useMemo(() => {
    return service.config.ports.map((portObject) => portObject.port.toString());
  }, [service.config.ports]);

  const allPortOptions = useMemo(() => {
    const allPorts = new Set([
      ...currentPorts,
      ...service.detected_ports.map((p) => p.port.toString()),
    ]);
    // A staged custom port is not on the service yet
    if (stagedHost && port !== undefined) allPorts.add(port.toString());

    return Array.from(allPorts);
  }, [service.detected_ports, currentPorts, stagedHost, port]);

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

  const form = useAppForm({
    defaultValues: {
      host: domain,
      targetPortType:
        port !== undefined && allPortOptions.includes(port.toString()) ? port.toString() : "",
      targetPort: "",
      isEditing: false,
    },
    onSubmit: async ({ value }) => {
      if (changeCount === 0 || mode !== "public") {
        form.reset();
        return;
      }
      const targetPort =
        value.targetPortType !== customPortText ? value.targetPortType : value.targetPort;
      const next = { host: value.host, port: Number(targetPort) };

      // A staged domain that gets another name is another change
      const isRenamedAddition = staged && !saved && next.host !== domain;
      const isBackToSaved = saved?.host === next.host && saved.port === next.port;
      if (staged && (isRenamedAddition || isBackToSaved)) discard([staged.id]);
      if (!isBackToSaved) stageHost(saved, next);
      form.reset();
    },
  });

  const remove = useCallback(() => {
    if (mode === "private") {
      stagePort(port, "remove");
      return;
    }
    stageHost({ host: domain, port }, null);
  }, [mode, stagePort, stageHost, domain, port]);

  const changeCount = useStore(form.store, (s) => {
    let count = 0;
    if (!s.fieldMeta.host?.isDefaultValue) count++;
    if (!s.fieldMeta.targetPortType?.isDefaultValue) count++;
    if (s.values.targetPortType === customPortText && !s.fieldMeta.targetPort?.isDefaultValue) {
      count++;
    }
    return count;
  });

  const isEditing = useStore(form.store, (s) => s.values.isEditing);
  const showDnsStatus =
    mode === "public" && !isEditing && dnsStatus !== undefined && stagedState === undefined;
  const savedStatus = useMemo(
    () =>
      mode === "public" && dnsStatus !== undefined
        ? { domain, dnsStatus, isCloudflare: !!isCloudflare }
        : undefined,
    [mode, domain, dnsStatus, isCloudflare],
  );

  const SuffixComponent = useCallback(
    ({ className }: { className?: string }) => {
      const buttonVariant = stagedState !== undefined ? "ghost-change-foreground" : "ghost";
      return (
        <div
          className={cn(
            "-my-2.5 -mr-3 flex items-start justify-end self-stretch p-0.5",
            isEditing && "opacity-0",
            className,
          )}
        >
          {stagedState && (
            <StagedChip staged={stagedState} isApplying={isApplying} className="mt-1.75 mr-1" />
          )}
          <CopyButton
            disabled={isEditing}
            classNameIcon="size-4"
            variant={buttonVariant}
            valueToCopy={getNetworkingDisplayUrl({
              host: domain,
              port: mode === "public" ? "" : port.toString(),
            })}
          />
          {mode === "public" && stagedState !== "deleted" && (
            <Button
              disabled={isEditing || isApplying}
              type="button"
              size="icon"
              variant={buttonVariant}
              aria-label="Edit"
              className="text-muted-more-foreground rounded-md"
              onClick={() => {
                form.setFieldValue("isEditing", true);
              }}
            >
              <PenIcon className="size-4" />
            </Button>
          )}
          {staged && (
            <Button
              disabled={isEditing || isApplying}
              type="button"
              size="icon"
              variant={buttonVariant}
              aria-label={stagedState === "deleted" ? "Restore" : "Discard"}
              className="text-muted-more-foreground rounded-md"
              onClick={() => discard([staged.id])}
            >
              <Undo2Icon className="size-4" />
            </Button>
          )}
          {!staged && service.type !== "database" && (
            <Button
              disabled={isEditing}
              type="button"
              size="icon"
              variant="ghost-destructive"
              aria-label="Delete"
              className="text-muted-more-foreground rounded-md"
              onClick={remove}
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </div>
      );
    },
    [
      isEditing,
      isApplying,
      mode,
      port,
      domain,
      service.type,
      form,
      staged,
      stagedState,
      discard,
      remove,
    ],
  );

  return (
    <div className="flex w-full flex-col gap-2">
      <div
        data-editing={isEditing || undefined}
        data-has-dns={showDnsStatus || undefined}
        data-staged={stagedState}
        data-applying={isApplying || undefined}
        className="data-editing:border-change/5-10 data-staged:border-change/5-10 group/field data-applying:animate-skeleton-smooth-weaker flex w-full flex-col overflow-hidden rounded-lg border transition-opacity duration-(--skeleton-smooth-lead-in) data-applying:pointer-events-none data-applying:opacity-(--skeleton-smooth-weaker-opacity) data-[staged=deleted]:opacity-60"
      >
        <BlockItemButtonLike
          asElement="div"
          classNameText="whitespace-normal"
          className="group-data-editing/field:bg-change/2-10 group-data-editing/field:text-change group-data-staged/field:bg-change/2-10 group-data-staged/field:text-change group-data-has-dns/field:ring-border z-1 border-none group-data-editing/field:rounded-b-none group-data-has-dns/field:ring-1"
          text={getNetworkingDisplayUrl({
            host: domain,
            port: mode === "public" ? "" : port?.toString(),
          })}
          description={({ className }) => {
            if (port === undefined || mode !== "public") return null;
            return (
              <div className="flex w-full flex-col">
                <div
                  className={cn(
                    "text-muted-foreground group-data-editing/field:text-change/9-10 group-data-staged/field:text-change/9-10 flex w-full items-start gap-1.5 text-sm leading-tight font-medium",
                    className,
                  )}
                >
                  <EthernetPortIcon className="mt-0.375 size-3.5 shrink-0" />
                  <p className="min-w-0 shrink">{port}</p>
                </div>
                {showDnsStatus && (
                  <DomainStatusRow
                    dnsStatus={dnsStatus}
                    isCloudflare={isCloudflare}
                    className="mt-2 border-t px-0 pt-2 pb-0 text-xs"
                  />
                )}
              </div>
            );
          }}
          Icon={({ className }: { className?: string }) =>
            port === undefined && !isEditing ? (
              <CircleAlertIcon className={cn("text-warning", className, "size-4.5")} />
            ) : mode === "private" ? (
              <GlobeLockIcon className={className} />
            ) : (
              <GlobeIcon className={className} />
            )
          }
          SuffixComponent={SuffixComponent}
        />
        {isEditing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit(e);
            }}
            className="border-change/5-10 flex w-full flex-col border-t"
          >
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
                          savedStatus={savedStatus}
                          hasChanges={!field.state.meta.isDefaultValue}
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
                        onChange: ({ value }) => validatePort({ value, isPublic: true }),
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
                              hasChanges={!field.state.meta.isDefaultValue}
                            />
                          </BlockItemContent>
                        </BlockItem>
                      )}
                    />
                  </Block>
                )}
                {allPortOptions.length !== 0 && (
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
                                  data-is-custom={field.state.value === customPortText || undefined}
                                  className="data-is-custom:rounded-b-none data-is-custom:border-b-0"
                                  asElement="button"
                                  text={
                                    field.state.value === "" ? "Select Port" : field.state.value
                                  }
                                  Icon={({ className }) => (
                                    <EthernetPortIcon className={className} />
                                  )}
                                  variant="outline"
                                  open={isOpen}
                                  onBlur={field.handleBlur}
                                  hasChanges={!field.state.meta.isDefaultValue}
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
                                hasChanges={!field.state.meta.isDefaultValue}
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
            <div className="bg-change/2-10 border-change/5-10 mt-1 flex w-full flex-col border-t p-1.5">
              <form.Subscribe
                selector={(s) => ({
                  isSubmitting: s.isSubmitting,
                })}
                children={({ isSubmitting }) => (
                  <div className="flex w-full">
                    <div className="w-1/2 p-1.5">
                      <Button
                        type="button"
                        variant="outline-change"
                        className="text-foreground has-hover:hover:text-foreground active:text-foreground w-full"
                        onClick={() => form.reset()}
                      >
                        Cancel
                      </Button>
                    </div>
                    <div className="w-1/2 p-1.5">
                      <form.SubmitButton
                        isPending={isSubmitting}
                        variant="change"
                        className="w-full"
                      >
                        Done
                      </form.SubmitButton>
                    </div>
                  </div>
                )}
              />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function getStagedState(staged?: TStagedListEntry): TStagedState | undefined {
  if (!staged) return undefined;
  if (staged.kind === "port") return staged.op === "add" ? "new" : "deleted";
  if (staged.kind !== "host") return undefined;
  if (staged.previous === null) return "new";
  return staged.value === null ? "deleted" : "updated";
}
