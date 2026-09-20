import { useTakenServiceNames } from "@/components/service/use-taken-service-names";
import { usePendingEntityStore } from "@/components/stores/pending/pending-entity-store-provider";
import { getUniqueName } from "@/lib/helpers/unique-name";
import { useCallback } from "react";

// Services are launched without asking for a name, so a taken one gets a suffix instead of an error
export function useUniqueServiceName(input: {
  teamId: string;
  projectId: string;
  environmentId: string;
}) {
  const { serviceNames } = useTakenServiceNames(input);
  const pendingServices = usePendingEntityStore((s) => s.pendingServices);

  return useCallback(
    (name: string) => {
      const pendingNames = pendingServices
        .filter((s) => s.environmentId === input.environmentId)
        .map((s) => s.name);
      return getUniqueName(name, [...serviceNames, ...pendingNames]);
    },
    [serviceNames, pendingServices, input.environmentId],
  );
}
