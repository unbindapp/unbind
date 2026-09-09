import ServiceIcon from "@/components/service/service-icon";
import { cn } from "@/components/ui/utils";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TServiceShallow } from "@/lib/queries/services";

// Pickers only label services that share a name with another one
export function getDuplicateServiceNames(services: TServiceShallow[]) {
  const counts = new Map<string, number>();
  for (const service of services) {
    counts.set(service.name, (counts.get(service.name) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

export function getServicePublicHost(service: TServiceShallow) {
  const host = service.config.hosts?.[0];
  if (!host) return null;
  return host.host + (host.path === "/" ? "" : host.path);
}

// Public host when the service has one, creation time otherwise
export function ServicePickerDescription({
  service,
  className,
}: {
  service: TServiceShallow;
  className?: string;
}) {
  const { str: createdAgo } = useTimeDifference({
    timestamp: new Date(service.created_at).getTime(),
  });
  const publicHost = getServicePublicHost(service);
  return (
    <p
      className={cn(
        "text-muted-foreground min-w-0 shrink truncate text-sm leading-tight font-normal",
        className,
      )}
    >
      {publicHost ?? `Created ${createdAgo}`}
    </p>
  );
}

export function ServicePickerItem({
  service,
  showDescription,
  className,
}: {
  service: TServiceShallow;
  showDescription: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 shrink items-center gap-2", className)}>
      <ServiceIcon service={service} className="size-4.5 shrink-0" />
      <div className="flex min-w-0 shrink flex-col gap-0.5">
        <p className="min-w-0 shrink truncate leading-tight">{service.name}</p>
        {showDescription && <ServicePickerDescription service={service} />}
      </div>
    </div>
  );
}
