import ServiceIcon from "@/components/service/service-icon";
import { cn } from "@/components/ui/utils";
import { useTimeDifference } from "@/lib/hooks/use-time-difference";
import { TServiceShallow } from "@/lib/queries/services";
import { BoxIcon, InfoIcon } from "lucide-react";

// Pickers only label services that share a name with another one
export function getDuplicateServiceNames(services: TServiceShallow[]) {
  const counts = new Map<string, number>();
  for (const service of services) {
    counts.set(service.name, (counts.get(service.name) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
}

type TStagedVolumeMount = { serviceId: string; volumeId: string; mountPath: string | null };

// Why a volume can't be mounted on the service. A service holds one volume and replicas
// can't share one. Staged mounts and unmounts count, they deploy together with this mount.
export function getMountBlocker(service: TServiceShallow, staged: TStagedVolumeMount[] = []) {
  const stagedForService = staged.filter((change) => change.serviceId === service.id);
  const unmounting = stagedForService.filter((c) => c.mountPath === null).map((c) => c.volumeId);
  const mounted = service.config.volumes.map((volume) => volume.id);
  if (mounted.some((id) => !unmounting.includes(id))) return "Already has a volume";

  const isMountStaged = stagedForService.some(
    (change) => change.mountPath !== null && !mounted.includes(change.volumeId),
  );
  if (isMountStaged) return "Already has a volume staged";
  if (service.config.replicas > 1) return "Reduce replicas to 1 to mount";
  return null;
}

// Services that can't mount a volume go last, in their original order
export function sortByMountBlocker(services: TServiceShallow[], staged?: TStagedVolumeMount[]) {
  const rank = (service: TServiceShallow) => (getMountBlocker(service, staged) ? 1 : 0);
  return services.toSorted((a, b) => rank(a) - rank(b));
}

export function ServicePickerHint({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex min-w-0 shrink items-start gap-1 text-sm leading-tight font-normal",
        className,
      )}
    >
      <div className="line-icon">
        <InfoIcon className="-ml-px size-3.5 shrink-0" />
      </div>
      <p className="min-w-0 shrink">{text}</p>
    </div>
  );
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
  hint,
  className,
}: {
  service: TServiceShallow;
  showDescription: boolean;
  hint?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 shrink items-center gap-2", className)}>
      <ServiceIcon service={service} className="size-4.5 shrink-0" />
      <div className="flex min-w-0 shrink flex-col gap-0.5">
        <p className="min-w-0 shrink truncate leading-tight">{service.name}</p>
        {showDescription && <ServicePickerDescription service={service} />}
        {hint && <ServicePickerHint text={hint} />}
      </div>
    </div>
  );
}

export function ServicePickerTriggerIcon({
  service,
  className,
  color,
}: {
  service: TServiceShallow | undefined;
  className?: string;
  color?: Parameters<typeof ServiceIcon>["0"]["color"];
}) {
  if (!service) return <BoxIcon className={className} />;
  return <ServiceIcon service={service} color={color} className={className} />;
}
