import { getGoClient } from "@/lib/server/client";
import type { ApplyStagedChangesInput, ApplyStagedChangesResponse } from "@/lib/server/client.gen";

export type TApplyStagedChangesResult = ApplyStagedChangesResponse;

export async function applyStagedChanges(
  input: ApplyStagedChangesInput,
): Promise<TApplyStagedChangesResult> {
  const res = await getGoClient().stagedChanges.apply(input);
  return res.data;
}
