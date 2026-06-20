import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { loadConfig } from "@/lib/config";
import "@/globals.css";
import { routeTree } from "./routeTree.gen";
import { DEFAULT_INTENT_DELAY_MS } from "@/lib/hooks/use-intent";

const DEFAULT_STALE_TIME_MS = 5 * 1000;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: DEFAULT_STALE_TIME_MS } },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: DEFAULT_STALE_TIME_MS,
  defaultPreloadDelay: DEFAULT_INTENT_DELAY_MS,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function bootstrap() {
  // Runtime config must be available before any component reads getConfig().
  await loadConfig();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
