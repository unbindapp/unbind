import { getGoClient } from "@/lib/server/client";
import type { ApplyChangesInput, ApplyChangesResponse } from "@/lib/server/client.gen";

export type TApplyChangesResult = ApplyChangesResponse;

export async function applyChanges(input: ApplyChangesInput): Promise<TApplyChangesResult> {
  const res = await getGoClient().changes.apply(input);
  return res.data;
}
