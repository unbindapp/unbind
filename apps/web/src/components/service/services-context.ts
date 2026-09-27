import type { TServiceShallow } from "@/lib/queries/services";
import type { UseQueryResult } from "@tanstack/react-query";
import { createContext } from "react";

// Lives apart from the provider so a hot reload of the provider keeps the same context object
export type TServicesResult = { services: TServiceShallow[] };

export type TServicesContext = {
  query: UseQueryResult<TServicesResult, Error>;
  teamId: string;
  projectId: string;
  environmentId: string;
};

export const ServicesContext = createContext<TServicesContext | null>(null);
