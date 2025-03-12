"use client";

import {
  gitProviders,
  TGitProvider,
} from "@/app/(team)/[team_id]/connect-git/_components/constants";
import GitProviderIcon from "@/components/icons/git-provider";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { createClient } from "@/server/go/client.gen";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon, LoaderIcon } from "lucide-react";
import { Session } from "next-auth";
import { useState } from "react";

type TProps = {
  teamId: string;
  session: Session;
};

type TPopupState = "closed" | "open" | "connected";

export default function GitProviderButtons({ teamId, session }: TProps) {
  const gitHubRedirectUrl = env.NEXT_PUBLIC_SITE_URL + `/${teamId}/connect-git/connected/github`;
  const [gitHubPopupState, setGitHubPopupState] = useState<TPopupState>("closed");

  const { mutate: onGitHubClick, isPending: isGitHubPending } = useMutation({
    mutationFn: async () =>
      createGitHubApp({
        redirectUrl: gitHubRedirectUrl,
        accessToken: session.access_token,
        setPopupState: setGitHubPopupState,
      }),
    mutationKey: ["create-github-app", { teamId }],
  });
  console.log("gitHubPopupState", gitHubPopupState);

  return gitProviders.map((provider) => (
    <GitProviderButton
      key={provider.slug}
      provider={provider}
      isPending={provider.slug === "github" ? isGitHubPending : false}
      onClick={provider.slug === "github" ? onGitHubClick : () => {}}
      popupState={provider.slug === "github" ? gitHubPopupState : "closed"}
    />
  ));
}

function GitProviderButton({
  provider,
  popupState,
  isPending,
  onClick,
}: {
  provider: TGitProvider;
  popupState: TPopupState;
  isPending: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      disabled={isPending || popupState === "connected"}
      fadeOnDisabled={false}
      onClick={onClick}
      variant={popupState === "connected" ? "success" : (provider.slug as "github" | "gitlab")}
      className="px-11"
    >
      <div className="absolute top-1/2 left-2.5 flex size-6 -translate-y-1/2 items-center justify-center">
        {isPending ? (
          <LoaderIcon className="size-full animate-spin p-0.25" />
        ) : (
          <GitProviderIcon className="size-full" variant={provider.slug} />
        )}
        <div
          data-show={popupState === "connected" ? true : undefined}
          className="bg-background text-success ring-success absolute -top-0.5 -right-0.5 size-3.5 scale-50 rounded-full p-0.75 opacity-0 ring-2 transition data-show:scale-100 data-show:opacity-100"
        >
          <CheckIcon strokeWidth={4} className="size-full" />
        </div>
      </div>
      <p className="min-w-0 shrink">
        {popupState === "connected"
          ? `Connected to ${provider.name}`
          : `Continue with ${provider.name}`}
      </p>
    </Button>
  );
}

async function createGitHubApp({
  redirectUrl,
  accessToken,
  setPopupState,
}: {
  redirectUrl: string;
  accessToken: string;
  setPopupState: (state: TPopupState) => void;
}) {
  const width = 800;
  const height = 600;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  const svg = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>`;
  const popup = window.open(
    "",
    "GitHubAuth",
    `width=${width},height=${height},top=${top},left=${left}`,
  );
  setPopupState("open");

  if (!popup) {
    setPopupState("closed");
    alert("Popup was blocked. Please allow popups for this site.");
    return;
  }

  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.success === true) {
      setPopupState("connected");
      clearInterval(interval);
      window.removeEventListener("message", messageHandler);
      popup.close();
    }
  };

  window.addEventListener("message", messageHandler);

  popup.document.write(`
    <html>
      <title>Connect GitHub</title>
      <head>
        <style>
          body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .loader-container {
            display: flex;
            justify-content: center;
            align-items: center;
            padding-bottom: calc(1rem + 4vh);
          }
          .loader {
            width: 2rem;
            height: 2rem;
            animation: spin 1s linear infinite;
          }
          .icon {
            width: 100%;
            height: 100%;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="loader-container">
          <div class="loader">
            ${svg}
          </div>
        </div>
      </body>
    </html>
  `);

  const abortController = new AbortController();

  const interval = setInterval(() => {
    if (popup.closed) {
      clearInterval(interval);
      abortController.abort();
      setPopupState("closed");
    }
  }, 250);

  const goClient = createClient({ accessToken, apiUrl: env.NEXT_PUBLIC_UNBIND_API_URL });

  const res = await goClient.github.app.create.get(
    { redirect_url: redirectUrl },
    { signal: abortController.signal },
  );
  popup.document.write(res.data);
}
