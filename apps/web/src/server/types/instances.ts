import type { GetInstanceHealthResponseBody } from "@/server/client.gen";

export type TInstanceFromHealth = GetInstanceHealthResponseBody["data"]["instances"][number];
