"use client";

import {
  StagedChangesPlanContext,
  StagedChangesStoreContext,
  type TStagedChangesPlanContext,
  type TStagedChangesStoreContext,
} from "@/components/staged-changes/staged-changes-context";
import {
  createStagedChangesStore,
  type TStagedChangesStore,
} from "@/components/staged-changes/staged-changes-store";
import {
  buildApplyChangesPayload,
  idsToKeepAfterFailures,
} from "@/components/staged-changes/payload";
import {
  countChanges,
  variableScopeKey,
  type TServiceChangeField,
  type TStagedChangesState,
  type TStagedServiceChange,
  type TStagedVariableChange,
  type TVariableScope,
} from "@/components/staged-changes/types";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
import { toast } from "@/components/ui/toast";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { applyChanges, type TApplyChangesResult } from "@/lib/queries/changes";
import { queryKeyVariables } from "@/lib/queries/variables";
import type { AffectedService } from "@/lib/server/client.gen";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { ReactNode, useContext, useMemo, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { useStore } from "zustand";

export function StagedChangesProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<TStagedChangesStoreContext | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createStagedChangesStore();
  }

  return (
    <StagedChangesStoreContext.Provider value={storeRef.current}>
      <ChangesPlanProvider>{children}</ChangesPlanProvider>
    </StagedChangesStoreContext.Provider>
  );
}

function useChangesStoreContext() {
  const context = useContext(StagedChangesStoreContext);
  if (!context) {
    throw new Error("useStagedChangesStore must be used within StagedChangesProvider");
  }
  return context;
}

export function useStagedChangesStore<T>(selector: (store: TStagedChangesStore) => T): T {
  return useStore(useChangesStoreContext(), selector);
}

export function useStagedChangeCount() {
  return useStagedChangesStore((s) => countChanges(s));
}

// A change is applying from the moment Deploy is pressed until the refetch after it lands
export type TStagedVariable = TStagedVariableChange & { isApplying: boolean };
export type TStagedServiceField = TStagedServiceChange & { isApplying: boolean };

export function useIsApplying() {
  return useStagedChangesStore((s) => Object.keys(s.applying).length > 0);
}

export function useStagedVariables(scope: TVariableScope | null) {
  const variables = useStagedChangesStore((s) => s.variables);
  const applying = useStagedChangesStore((s) => s.applying);
  const key = scope ? variableScopeKey(scope) : null;
  return useMemo(() => {
    const byName = new Map<string, TStagedVariable>();
    if (key === null) return byName;
    for (const change of Object.values(variables)) {
      if (variableScopeKey(change.scope) !== key) continue;
      byName.set(change.name, { ...change, isApplying: change.id in applying });
    }
    return byName;
  }, [variables, applying, key]);
}

export function useStagedServiceChanges(serviceId: string) {
  const services = useStagedChangesStore((s) => s.services);
  const applying = useStagedChangesStore((s) => s.applying);
  return useMemo(() => {
    const byField: Partial<Record<TServiceChangeField, TStagedServiceField>> = {};
    for (const change of Object.values(services)) {
      if (change.serviceId !== serviceId) continue;
      byField[change.field] = { ...change, isApplying: change.id in applying };
    }
    return byField;
  }, [services, applying, serviceId]);
}

export function useServiceChangeCount(serviceId: string) {
  return useStagedChangesStore(
    (s) =>
      Object.values(s.services).filter((c) => c.serviceId === serviceId).length +
      Object.values(s.variables).filter((c) => c.scope.serviceId === serviceId).length,
  );
}

export function useIsServiceApplying(serviceId: string) {
  return useStagedChangesStore(
    (s) =>
      Object.values(s.services).some((c) => c.serviceId === serviceId && c.id in s.applying) ||
      Object.values(s.variables).some((c) => c.scope.serviceId === serviceId && c.id in s.applying),
  );
}

// Refetches what a deploy changed before the stage lets go of it, so nothing disappears in
// between. Cached scopes and services that are off screen refetch too, so they are current
// when the user gets there.
function refetchChangedData(
  queryClient: QueryClient,
  state: TStagedChangesState,
  affected: AffectedService[],
) {
  const scopes = new Map(
    Object.values(state.variables).map((c) => [variableScopeKey(c.scope), c.scope]),
  );
  const affectedIds = new Set(affected.map((a) => a.service_id));
  return Promise.all([
    ...[...scopes.values()].map((scope) =>
      queryClient.refetchQueries({ queryKey: queryKeyVariables.list(scope), type: "all" }),
    ),
    queryClient.refetchQueries({ queryKey: ["variables", "available"] }),
    queryClient.refetchQueries({ queryKey: ["services", "list"] }),
    queryClient.refetchQueries({
      queryKey: ["services", "detail"],
      type: "all",
      predicate: (query) => affectedIds.has(String(query.queryKey.at(-1))),
    }),
  ]);
}

// The plan is a dry run of the staged changes: it validates them and lists the
// services that would roll out, including ones only affected through references
function ChangesPlanProvider({ children }: { children: ReactNode }) {
  const store = useChangesStoreContext();
  const variables = useStagedChangesStore((s) => s.variables);
  const services = useStagedChangesStore((s) => s.services);
  const beginApplying = useStagedChangesStore((s) => s.beginApplying);
  const endApplying = useStagedChangesStore((s) => s.endApplying);
  const queryClient = useQueryClient();
  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();
  const [lastResult, setLastResult] = useState<TApplyChangesResult | null>(null);

  const count = countChanges({ variables, services });
  const payload = useMemo(
    () => buildApplyChangesPayload({ variables, services }),
    [variables, services],
  );
  const [debouncedPayload] = useDebounceValue(payload, 500);

  const debouncedCount = debouncedPayload.variables.length + debouncedPayload.services.length;

  const plan = useQuery({
    queryKey: ["changes", "plan", debouncedPayload],
    queryFn: () => applyChanges({ ...debouncedPayload, dry_run: true }),
    enabled: debouncedCount > 0,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const deploy = useMutation({
    mutationFn: () => applyChanges(buildApplyChangesPayload(store.getState())),
    onMutate: () => beginApplying(),
    onError: () => endApplying(new Set()),
    onSuccess: async (result) => {
      setLastResult(result);
      const state = store.getState();
      const kept = idsToKeepAfterFailures(state, result.failures);
      const settled = new Set(Object.keys(state.applying).filter((id) => !kept.has(id)));
      // Variables that landed light up in the list once it refetches
      for (const change of Object.values(state.variables)) {
        if (!settled.has(change.id) || change.value === null) continue;
        temporarilyAddNewEntity(
          getNewEntityIdForVariable({ name: change.name, value: change.value }),
        );
      }
      await refetchChangedData(queryClient, state, result.affected);
      endApplying(settled);
      queryClient.invalidateQueries();
      if (result.failures.length > 0) return;
      const rolledOut = result.affected.filter((a) => a.action !== "none").length;
      toast.add({
        type: "success",
        title: "Changes deployed",
        description:
          rolledOut === 0
            ? "Nothing was running, the changes apply on the next deployment."
            : `${rolledOut} ${rolledOut === 1 ? "service is" : "services are"} rolling out.`,
      });
    },
  });

  const affectedByService = useMemo(() => {
    const map = new Map<string, AffectedService>();
    if (count === 0 || !plan.data) return map;
    for (const affected of plan.data.affected) {
      map.set(affected.service_id, affected);
    }
    return map;
  }, [plan.data, count]);

  const value = useMemo<TStagedChangesPlanContext>(
    () => ({ count, plan, affectedByService, deploy, lastResult }),
    [count, plan, affectedByService, deploy, lastResult],
  );

  return (
    <StagedChangesPlanContext.Provider value={value}>{children}</StagedChangesPlanContext.Provider>
  );
}

export function useStagedChangesPlan() {
  const context = useContext(StagedChangesPlanContext);
  if (!context) {
    throw new Error("useStagedChangesPlan must be used within StagedChangesProvider");
  }
  return context;
}
