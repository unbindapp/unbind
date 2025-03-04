"use client";

import GitProviderIcon from "@/components/icons/git-provider";
import PageWrapper from "@/components/page-wrapper";
import { LoaderIcon } from "lucide-react";
import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code && window.opener) {
      // Send the code back to the main window.
      window.opener.postMessage({ code }, window.location.origin);
      // Optionally, add a small delay if needed, then close the popup.
      setTimeout(() => {
        window.close();
      }, 100);
    }
  }, []);

  return (
    <PageWrapper className="items-center justify-center">
      <div className="flex w-full flex-col items-center justify-center pb-[5vh] text-center">
        <LoaderIcon className="size-8 animate-spin" />
        <p className="text-muted-foreground mt-4 w-full text-base leading-tight font-medium">
          Connecting to:
        </p>
        <div className="mt-2 flex w-full items-center justify-center gap-2">
          <GitProviderIcon variant="github" className="size-8" />
          <p className="min-w-0 shrink text-3xl leading-tight font-semibold">GitHub</p>
        </div>
      </div>
    </PageWrapper>
  );
}
