import { AppRouterOutputs } from "@/server/trpc/api/root";

export type TInstanceFromHealth =
  AppRouterOutputs["instances"]["health"]["data"]["instances"][number];
