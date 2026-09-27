import type { TVolumeShallow } from "@/lib/queries/services";
import type { UseQueryResult } from "@tanstack/react-query";
import { createContext } from "react";

// Lives apart from the provider so a hot reload of the provider keeps the same context object
export type TVolumesResult = { volumes: TVolumeShallow[] };

export type TVolumesContext = {
  query: UseQueryResult<TVolumesResult, Error>;
  teamId: string;
  projectId: string;
  environmentId: string;
};

export const VolumesContext = createContext<TVolumesContext | null>(null);
