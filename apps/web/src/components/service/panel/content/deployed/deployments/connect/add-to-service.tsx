"use client";

import { BlockItemButtonLike } from "@/components/block";
import { variableNameFor } from "@/components/service/panel/content/deployed/deployments/connect/helpers";
import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import {
  getDuplicateServiceNames,
  ServicePickerItem,
  ServicePickerTriggerIcon,
} from "@/components/service/service-picker";
import { useService } from "@/components/service/service-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { prefillCreateVariablesForm } from "@/components/variables/create-variables-form";
import { TCommandItem, useAppForm } from "@/lib/hooks/use-app-form";
import { servicesListQuery } from "@/lib/queries/services";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, BoxIcon } from "lucide-react";
import { useCallback, useMemo } from "react";

type TUsable = {
  databaseType: string;
  // The readable ${Database.KEY} token, what the variable's value becomes
  value: string;
  // Protocol of a secondary endpoint, part of the variable's name
  label?: string;
  isPlaceholder?: never;
  isDisabled?: never;
};

type TUnusable = { databaseType?: never; value?: never; label?: never };

type TProps = { className?: string } & (
  | TUsable
  // Nothing is known yet, the row is still loading
  | ({ isPlaceholder: true; isDisabled?: never } & TUnusable)
  // There is no URL to add yet, so the controls are shown but cannot be used
  | ({ isDisabled: true; isPlaceholder?: never } & TUnusable)
);

// Points another service at this database: it fills that service's variable form and
// opens it, so the name can be edited there and staged like any other variable.
export default function AddToService({
  databaseType,
  value,
  label,
  isPlaceholder,
  isDisabled,
  className,
}: TProps) {
  const { teamId, projectId, environmentId } = useService();
  const { openPanel } = useServicePanel();

  const { data, isPending, error } = useQuery(
    servicesListQuery({ teamId, projectId, environmentId }),
  );

  // A database consuming another database's URL is not a thing, and an undeployed
  // service has no variables page for the value to land on
  const services = useMemo(
    () =>
      data?.services.filter((service) => service.type !== "database" && service.last_deployment),
    [data],
  );

  const items: TCommandItem[] | undefined = useMemo(
    () =>
      services?.map((service) => ({
        value: service.id,
        label: service.name,
        keywords: [service.name],
      })),
    [services],
  );

  const ServiceItemElement = useCallback(
    ({ item, className }: { item: TCommandItem; className?: string }) => {
      const service = services?.find((s) => s.id === item.value);
      if (!service) return <p className={cn("min-w-0 leading-tight", className)}>{item.label}</p>;
      const duplicates = getDuplicateServiceNames(services ?? []);
      return (
        <ServicePickerItem
          service={service}
          showDescription={duplicates.has(service.name)}
          className={className}
        />
      );
    },
    [services],
  );

  const form = useAppForm({ defaultValues: { serviceId: "" } });

  const add = useCallback(
    (serviceId: string) => {
      if (value === undefined) return;
      prefillCreateVariablesForm(
        { type: "service", teamId, projectId, environmentId, serviceId },
        { name: variableNameFor(databaseType ?? "", label), value },
      );
      form.reset();
      openPanel(serviceId, "variables");
    },
    [teamId, projectId, environmentId, databaseType, label, value, form, openPanel],
  );

  return (
    <div className={cn("flex w-full min-w-0 items-start gap-1.5", className)}>
      <form.AppField
        name="serviceId"
        children={(field) => (
          <field.AsyncAndSearchableSelect
            field={field}
            hideError
            isDeselectable
            className="min-w-0 flex-1"
            value={field.state.value}
            onChange={(v: string) => field.handleChange(v)}
            items={items}
            isPending={isPending}
            error={error?.message}
            commandInputPlaceholder="Search services..."
            CommandEmptyText="No deployed services"
            CommandEmptyIcon={BoxIcon}
            CommandItemElement={ServiceItemElement}
          >
            {({ isOpen }: { isOpen: boolean }) => {
              const selected = services?.find((s) => s.id === field.state.value);
              return (
                <BlockItemButtonLike
                  asElement="button"
                  text={selected?.name ?? "Select a service"}
                  Icon={({ className }: { className?: string }) => (
                    <ServicePickerTriggerIcon service={selected} className={className} />
                  )}
                  open={isOpen}
                  isPending={isPending || isPlaceholder}
                  disabled={isDisabled}
                />
              );
            }}
          </field.AsyncAndSearchableSelect>
        )}
      />
      <form.Subscribe
        selector={(state) => state.values.serviceId}
        children={(serviceId) => (
          <Button
            type="button"
            variant="outline"
            data-pending={isPlaceholder || undefined}
            disabled={isPlaceholder || isDisabled || serviceId === ""}
            fadeOnDisabled={isPlaceholder ? false : "default"}
            onClick={() => add(serviceId)}
            className="data-pending:bg-muted-more-foreground data-pending:animate-skeleton max-w-1/2 shrink-0 gap-1 px-4 data-pending:text-transparent"
          >
            <span className="min-w-0 shrink truncate">Add</span>
            <ArrowRightIcon className="-mr-1.25 size-4.5" />
          </Button>
        )}
      />
    </div>
  );
}
