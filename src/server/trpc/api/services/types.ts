import { AppRouterOutputs } from "@/server/trpc/api/root";

export type TServiceShallow = AppRouterOutputs["services"]["list"]["services"][number];
export type TService = AppRouterOutputs["services"]["get"]["service"];
