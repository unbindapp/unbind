"use client";

import { BlockItemButtonLike, BlockItemToggle } from "@/components/block";
import ErrorLine from "@/components/error-line";
import NoItemsCard from "@/components/no-items-card";
import { searchItems } from "@/components/system/settings/network-search";
import { Section, SectionSkeleton } from "@/components/system/settings/section";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import {
  createNetworkException,
  deleteNetworkException,
  networkServicesQuery,
  networkSettingsQuery,
  queryKeyNetwork,
  TNetworkException,
  TNetworkService,
  updateNetworkSettings,
} from "@/lib/queries/network";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  BoxIcon,
  GlobeIcon,
  PlusIcon,
  ShieldIcon,
  Trash2Icon,
  WaypointsIcon,
} from "lucide-react";
import { ComponentProps, useMemo, useState } from "react";

const anySource = "any";
const anySourcePath = "Servers, hosts and every team";

type TProps = {
  className?: string;
};

export default function NetworkTabContent({ className }: TProps) {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery(networkSettingsQuery());
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeyNetwork.settings() });

  if (!data && isPending) {
    return (
      <div className={cn("flex w-full flex-col gap-6", className)}>
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("flex w-full flex-col", className)}>
        <ErrorLine withIcon message={error?.message} />
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      <Section
        title="Team Isolation"
        description="Services only accept connections from their own team and from Unbind. Add the exceptions below before turning it on."
      >
        <IsolationToggle enabled={data.data.team_network_isolation} onSaved={invalidate} />
      </Section>
      <Section
        title="Exceptions"
        description="Let a service accept connections from a service in another team, or from any source."
      >
        <div className="flex w-full flex-col gap-2">
          <AddExceptionForm onSaved={invalidate} />
          <ExceptionsList exceptions={data.data.exceptions} onDeleted={invalidate} />
        </div>
      </Section>
    </div>
  );
}

function IsolationToggle({ enabled, onSaved }: { enabled: boolean; onSaved: () => Promise<void> }) {
  const { mutate: update, isPending } = useMutation({
    mutationFn: (checked: boolean) => updateNetworkSettings({ team_network_isolation: checked }),
    onSuccess: onSaved,
    onError: (error) => {
      toast.add({ type: "error", title: "Couldn't update isolation", description: error.message });
    },
  });

  return (
    <BlockItemToggle
      Icon={ShieldIcon}
      text="Isolate teams from each other"
      checked={enabled}
      disabled={isPending}
      onCheckedChange={(checked) => update(checked)}
    />
  );
}

function serviceItem(service: TNetworkService): TCommandItem {
  const description = servicePath(service);
  return {
    value: service.id,
    label: service.name,
    description,
  };
}

function servicePath(service: TNetworkService) {
  return `${service.team_name} / ${service.project_name} / ${service.environment_name}`;
}

function ServiceItemElement({ item, className }: { item: TCommandItem; className?: string }) {
  return (
    <div className={cn("flex min-w-0 shrink flex-col gap-1 leading-tight", className)}>
      <p className="min-w-0 truncate">{item.label}</p>
      {item.description && (
        <p className="text-muted-foreground min-w-0 truncate text-sm">{item.description}</p>
      )}
    </div>
  );
}

function AddExceptionForm({ onSaved }: { onSaved: () => Promise<void> }) {
  const { data, isPending, error } = useQuery(networkServicesQuery());
  const { mutateAsync: create, error: createError } = useMutation({
    mutationFn: createNetworkException,
  });

  const services = data?.data;
  const targetItems = useMemo(() => services?.map(serviceItem), [services]);
  const sourceItems = useMemo(
    () =>
      targetItems && [
        {
          value: anySource,
          label: "Any source",
          description: anySourcePath,
        },
        ...targetItems,
      ],
    [targetItems],
  );

  const [sourceSearch, setSourceSearch] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const foundSources = useMemo(
    () => sourceItems && searchItems(sourceItems, sourceSearch),
    [sourceItems, sourceSearch],
  );
  const foundTargets = useMemo(
    () => targetItems && searchItems(targetItems, targetSearch),
    [targetItems, targetSearch],
  );

  const form = useAppForm({
    defaultValues: { source: "", target: "" },
    onSubmit: async ({ value }) => {
      await create({
        target_service_id: value.target,
        ...(value.source === anySource ? {} : { source_service_id: value.source }),
      });
      form.reset();
      await onSaved();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit(e);
      }}
      className="flex w-full flex-col gap-2"
    >
      <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
        <form.AppField
          name="source"
          children={(field) => (
            <field.AsyncAndSearchableSelect
              field={field}
              hideError
              className="min-w-0 flex-1"
              value={field.state.value}
              onChange={(v: string) => {
                field.handleChange(v);
                setSourceSearch("");
              }}
              items={foundSources}
              commandShouldntFilter
              commandInputValue={sourceSearch}
              commandInputValueOnChange={setSourceSearch}
              isPending={isPending}
              error={error?.message}
              commandInputPlaceholder="Search services..."
              CommandEmptyText="No services"
              CommandEmptyIcon={BoxIcon}
              CommandItemElement={ServiceItemElement}
            >
              {({ isOpen }: { isOpen: boolean }) => (
                <ServiceTrigger
                  services={services}
                  value={field.state.value}
                  isOpen={isOpen}
                  isPending={isPending}
                  placeholder="Select a source"
                />
              )}
            </field.AsyncAndSearchableSelect>
          )}
        />
        <ArrowRightIcon className="text-muted-foreground size-5 shrink-0 self-center max-md:rotate-90" />
        <form.AppField
          name="target"
          children={(field) => (
            <field.AsyncAndSearchableSelect
              field={field}
              hideError
              className="min-w-0 flex-1"
              value={field.state.value}
              onChange={(v: string) => {
                field.handleChange(v);
                setTargetSearch("");
              }}
              items={foundTargets}
              commandShouldntFilter
              commandInputValue={targetSearch}
              commandInputValueOnChange={setTargetSearch}
              isPending={isPending}
              error={error?.message}
              commandInputPlaceholder="Search services..."
              CommandEmptyText="No services"
              CommandEmptyIcon={BoxIcon}
              CommandItemElement={ServiceItemElement}
            >
              {({ isOpen }: { isOpen: boolean }) => (
                <ServiceTrigger
                  services={services}
                  value={field.state.value}
                  isOpen={isOpen}
                  isPending={isPending}
                  placeholder="Select a target"
                />
              )}
            </field.AsyncAndSearchableSelect>
          )}
        />
        <form.Subscribe
          selector={(state) => ({
            isSubmitting: state.isSubmitting,
            source: state.values.source,
            target: state.values.target,
          })}
          children={({ isSubmitting, source, target }) => (
            <Button
              type="submit"
              isPending={isSubmitting}
              disabled={source === "" || target === ""}
              className="shrink-0 gap-1.5 md:self-stretch"
            >
              <PlusIcon className="-ml-0.5 size-4.5 shrink-0" />
              <p className="min-w-0 shrink">Add</p>
            </Button>
          )}
        />
      </div>
      {createError && <ErrorLine message={createError.message} />}
    </form>
  );
}

function ServiceTrigger({
  services,
  value,
  isOpen,
  isPending,
  placeholder,
  ...props
}: {
  services: TNetworkService[] | undefined;
  value: string;
  isOpen: boolean;
  isPending: boolean;
  placeholder: string;
} & Omit<ComponentProps<"button">, "value">) {
  const isAny = value === anySource;
  const selected = services?.find((s) => s.id === value);
  const Icon = isAny ? GlobeIcon : BoxIcon;

  return (
    <BlockItemButtonLike
      asElement="button"
      text={isAny ? "Any source" : (selected?.name ?? placeholder)}
      Icon={({ className }: { className?: string }) => <Icon className={className} />}
      open={isOpen}
      isPending={isPending}
      {...props}
    />
  );
}

function ExceptionsList({
  exceptions,
  onDeleted,
}: {
  exceptions: TNetworkException[];
  onDeleted: () => Promise<void>;
}) {
  if (exceptions.length === 0) {
    return <NoItemsCard Icon={WaypointsIcon}>No exceptions yet</NoItemsCard>;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {exceptions.map((exception) => (
        <ExceptionCard key={exception.id} exception={exception} onDeleted={onDeleted} />
      ))}
    </div>
  );
}

function ExceptionCard({
  exception,
  onDeleted,
}: {
  exception: TNetworkException;
  onDeleted: () => Promise<void>;
}) {
  const sourceName = exception.source?.name ?? "Any source";

  return (
    <div className="relative flex w-full flex-col gap-3 rounded-xl border p-3 pr-12 sm:flex-row sm:items-center sm:p-4 sm:pr-14">
      <ExceptionEnd
        Icon={exception.source ? BoxIcon : GlobeIcon}
        name={sourceName}
        path={exception.source ? servicePath(exception.source) : anySourcePath}
      />
      <ArrowRightIcon className="text-muted-foreground size-4.5 shrink-0 max-sm:rotate-90" />
      <ExceptionEnd
        Icon={BoxIcon}
        name={exception.target.name}
        path={servicePath(exception.target)}
      />
      <DeleteExceptionTrigger exception={exception} onDeleted={onDeleted} />
    </div>
  );
}

function ExceptionEnd({ Icon, name, path }: { Icon: typeof BoxIcon; name: string; path: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-1.5 leading-tight">
      <div className="line-icon">
        <Icon className="size-4.5" />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="min-w-0 truncate font-medium">{name}</p>
        <p className="text-muted-foreground min-w-0 truncate text-sm">{path}</p>
      </div>
    </div>
  );
}

function DeleteExceptionTrigger({
  exception,
  onDeleted,
}: {
  exception: TNetworkException;
  onDeleted: () => Promise<void>;
}) {
  const {
    mutateAsync: remove,
    error,
    reset,
  } = useMutation({
    mutationFn: () => deleteNetworkException({ id: exception.id }),
    onSuccess: onDeleted,
  });

  return (
    <DeleteEntityTrigger
      dialogTitle="Remove Exception"
      dialogDescription={`${exception.target.name} stops accepting connections from ${exception.source?.name ?? "any source"} while teams are isolated.`}
      deletingEntityName="exception"
      disableConfirmationInput
      submitButtonText="Remove"
      error={error}
      onDialogClose={reset}
      onSubmit={async () => {
        await remove();
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Remove exception"
        className="text-muted-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded-lg sm:right-2.5"
      >
        <Trash2Icon className="size-4.5" />
      </Button>
    </DeleteEntityTrigger>
  );
}
