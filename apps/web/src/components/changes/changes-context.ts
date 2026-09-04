import type { createChangesStore } from "@/components/changes/changes-store";
import type { TApplyChangesResult } from "@/lib/queries/changes";
import type { AffectedService } from "@/lib/server/client.gen";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { createContext } from "react";

// Contexts live apart from the provider so a hot reload of the provider module
// keeps the same context objects the consumers already hold
export type TChangesStoreContext = ReturnType<typeof createChangesStore>;

export const ChangesStoreContext = createContext<TChangesStoreContext | undefined>(undefined);

export type TChangesPlanContext = {
  count: number;
  plan: UseQueryResult<TApplyChangesResult, Error>;
  affectedByService: Map<string, AffectedService>;
  deploy: UseMutationResult<TApplyChangesResult, Error, void>;
  lastResult: TApplyChangesResult | null;
};

export const ChangesPlanContext = createContext<TChangesPlanContext | undefined>(undefined);
