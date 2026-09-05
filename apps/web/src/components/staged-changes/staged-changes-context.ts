import type { createStagedChangesStore } from "@/components/staged-changes/staged-changes-store";
import type { TApplyChangesResult } from "@/lib/queries/changes";
import type { AffectedService } from "@/lib/server/client.gen";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { createContext } from "react";

// Contexts live apart from the provider so a hot reload of the provider module
// keeps the same context objects the consumers already hold
export type TStagedChangesStoreContext = ReturnType<typeof createStagedChangesStore>;

export const StagedChangesStoreContext = createContext<TStagedChangesStoreContext | undefined>(
  undefined,
);

export type TStagedChangesPlanContext = {
  count: number;
  plan: UseQueryResult<TApplyChangesResult, Error>;
  affectedByService: Map<string, AffectedService>;
  deploy: UseMutationResult<TApplyChangesResult, Error, void>;
  lastResult: TApplyChangesResult | null;
};

export const StagedChangesPlanContext = createContext<TStagedChangesPlanContext | undefined>(
  undefined,
);
