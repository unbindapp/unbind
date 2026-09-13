import { contextCommandPanelRootPage } from "@/components/command-panel/constants";
import { useCommandPanelStore } from "@/components/command-panel/store/command-panel-store-provider";
import useCommandPanel from "@/components/command-panel/use-command-panel";
import { toast } from "@/components/ui/toast";
import { ResultAsync } from "neverthrow";
import { useCallback } from "react";

// Wraps a typesafe `router.navigate(...)` call with the command-panel
// pending state, error toast, and panel close behavior.
export default function useNavigateFromCommandPanel() {
  const setIsPendingId = useCommandPanelStore((s) => s.setIsPendingId);
  const { closePanel } = useCommandPanel({
    defaultPageId: contextCommandPanelRootPage,
  });

  const navigateTo = useCallback(
    async ({
      run,
      isPendingId,
      error,
    }: {
      run: () => Promise<unknown>;
      isPendingId: string;
      error: string;
    }) => {
      setIsPendingId(isPendingId);
      const res = await ResultAsync.fromPromise(run(), () => new Error(error));
      if (res.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to navigate",
          description: res.error.message,
          timeout: 3000,
        });
        setIsPendingId(null);
        return;
      }
      setIsPendingId(null);
      closePanel();
    },
    [closePanel, setIsPendingId],
  );

  return navigateTo;
}
