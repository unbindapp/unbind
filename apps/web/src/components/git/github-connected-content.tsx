"use client";

import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import PageWrapper from "@/components/page-wrapper";
import { gitAppQuery, saveGitApp } from "@/lib/queries/git";
import { useQuery } from "@tanstack/react-query";
import { LoaderIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type TProps = {
  id: string;
};

export default function Content({ id }: TProps) {
  const { data } = useQuery({ ...gitAppQuery({ uuid: id }), refetchInterval: 1000 });

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
    if (currentState !== "has-opener") return;
    if (!data || data.app.installations.length < 1) return;

    window.opener.postMessage({ success: true }, window.location.origin);
  }, [currentState, data]);

  return <ConnectionStatus failed={currentState === "no-opener"} />;
}

// GitHub returns here with a code once the app is created, saving it hands back the install page
export function GithubSaveContent({ code, state }: { code: string; state: string }) {
  const [error, setError] = useState<string>();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    saveGitApp({ code, state })
      .then((data) => window.location.replace(data.install_url))
      .catch((e: Error) => setError(e.message));
  }, [code, state]);

  return <ConnectionStatus failed={!!error} error={error} />;
}

function ConnectionStatus({ failed, error }: { failed: boolean; error?: string }) {
  return (
    <PageWrapper className="items-center justify-center">
      <div className="flex w-full flex-col items-center justify-center pb-[5vh] text-center">
        {failed ? (
          <TriangleAlertIcon className="text-muted-foreground size-8" />
        ) : (
          <LoaderIcon className="text-muted-foreground size-8 animate-spin" />
        )}
        <p className="text-muted-foreground mt-3 w-full text-base leading-tight font-medium">
          {failed ? "Connection failed" : "Connecting to:"}
        </p>
        <div className="mt-2 flex w-full items-center justify-center gap-2">
          <BrandIcon brand="github" className="size-8 shrink-0" />
          <p className="min-w-0 shrink text-3xl leading-none font-semibold">GitHub</p>
        </div>
        {error && <ErrorLine message={error} className="mt-6 max-w-md" />}
      </div>
    </PageWrapper>
  );
}
