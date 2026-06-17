import type { GetInstanceHealthResponseBody } from "@/server/go/client.gen";

export type TInstanceFromHealth =
  GetInstanceHealthResponseBody["data"]["instances"][number];
