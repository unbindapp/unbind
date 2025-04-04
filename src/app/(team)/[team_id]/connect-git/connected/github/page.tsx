"use client";

import BrandIcon from "@/components/icons/brand";
import PageWrapper from "@/components/page-wrapper";
import { LoaderIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

export default function Page() {
  const [currentState, setCurrentState] = useState<"loading" | "has-opener" | "no-opener">(
    "loading",
  );
  useEffect(() => {
    if (window.opener) {
      setCurrentState("has-opener");
    } else {
      setCurrentState("no-opener");
    }
  }, []);

  useEffect(() => {
    if (currentState === "has-opener") {
      window.opener.postMessage({ success: true }, window.location.origin);
    }
  }, [currentState]);

  return (
    <PageWrapper className="items-center justify-center">
      <div className="flex w-full flex-col items-center justify-center pb-[5vh] text-center">
        {currentState === "no-opener" ? (
          <TriangleAlertIcon className="text-muted-foreground size-8" />
        ) : (
          <LoaderIcon className="text-muted-foreground size-8 animate-spin" />
        )}
        <p className="text-muted-foreground mt-3 w-full text-base leading-tight font-medium">
          {currentState === "no-opener" ? "Connection failed" : "Connecting to:"}
        </p>
        <div className="mt-2 flex w-full items-center justify-center gap-2">
          <BrandIcon brand="github" className="size-8 shrink-0" />
          <p className="min-w-0 shrink text-3xl leading-none font-semibold">GitHub</p>
        </div>
      </div>
    </PageWrapper>
  );
}
