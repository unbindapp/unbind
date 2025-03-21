import { TService, TServiceGroup } from "@/server/trpc/api/main/router";

export function groupByServiceGroup(services: TService[] | undefined) {
  const groupedServices: {
    group: TServiceGroup | null;
    services: TService[];
  }[] = [];
  services?.forEach((service) => {
    const group = service.serviceGroup;
    const existingGroup = groupedServices.find((g) => g.group?.id === group?.id);
    if (existingGroup) {
      existingGroup.services.push(service);
    } else if (group) {
      groupedServices.push({ group, services: [service] });
    } else {
      groupedServices.push({ group: null, services: [service] });
    }
  });
  return groupedServices;
}

export function isUUID(str: string | undefined | null): boolean {
  if (typeof str !== "string") return false;
  return /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(str);
}
