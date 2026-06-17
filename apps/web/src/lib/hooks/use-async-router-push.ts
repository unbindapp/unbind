import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

/**
 * Awaitable navigation. TanStack Router's `navigate` already returns a promise that
 * resolves once navigation (and any matched loaders) settle, so unlike the old Next
 * workaround this is a thin wrapper. Accepts a fully-built path via `href`.
 */
export const useAsyncRouterPush = () => {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const asyncPush = async (path: string) => {
    setIsPending(true);
    try {
      await router.navigate({ href: path });
    } finally {
      setIsPending(false);
    }
  };

  return [asyncPush, isPending] as const;
};
