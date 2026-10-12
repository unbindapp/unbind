import { queryOptions } from "@tanstack/react-query";

import { getGoClient } from "@/lib/server/client";
import type { EmailSettingsResponseBody, EmailSettingsUpdateInput } from "@/lib/server/client.gen";

export const queryKeyEmail = {
  settings: () => ["system", "email"] as const,
};

export type TEmailSettings = EmailSettingsResponseBody["data"];

export const emailSettingsQuery = () =>
  queryOptions({
    queryKey: queryKeyEmail.settings(),
    queryFn: async () => {
      const res = await getGoClient().system.email.get();
      return { data: res.data };
    },
  });

export async function updateEmailSettings(input: EmailSettingsUpdateInput) {
  const res = await getGoClient().system.email.update(input);
  return { data: res.data };
}

export async function clearEmailSettings() {
  await getGoClient().system.email.clear();
}

export async function sendTestEmail() {
  const res = await getGoClient().system.email.test();
  return { data: res.data };
}
