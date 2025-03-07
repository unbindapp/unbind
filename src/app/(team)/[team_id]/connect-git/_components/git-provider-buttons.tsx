"use client";

import GitProviderIcon from "@/components/icons/git-provider";
import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import { useMutation } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";
import { Session } from "next-auth";
import { useState } from "react";

type TProps = {
  teamId: string;
  session: Session;
};

type TPopupState = "closed" | "open" | "success";

export default function GitProviderButtons({ teamId, session }: TProps) {
  const [gitHubPopupState, setGitHubPopupState] = useState<TPopupState>("closed");
  const { mutate: onGitHubClick, isPending: isGitHubPending } = useMutation({
    mutationFn: async () =>
      createGitHubApp({
        teamId,
        accessToken: session.access_token,
        setPopupState: setGitHubPopupState,
      }),
    mutationKey: ["create-github-app", { teamId }],
  });

  return (
    <>
      <Button
        disabled={isGitHubPending}
        fadeOnDisabled={false}
        onClick={() => onGitHubClick()}
        variant="github"
        className="px-11"
      >
        <div className="absolute top-1/2 left-2.5 flex size-6 -translate-y-1/2 items-center justify-center">
          {isGitHubPending ? (
            <LoaderIcon className="size-full animate-spin p-0.5" />
          ) : (
            <GitProviderIcon className="size-full" variant="github" />
          )}
        </div>
        <p className="min-w-0 shrink">Continue with GitHub</p>
      </Button>
      <Button variant="gitlab" className="px-11">
        <GitProviderIcon
          className="absolute top-1/2 left-2.5 size-6 -translate-y-1/2"
          variant="gitlab"
        />
        <p className="min-w-0 shrink">Continue with GitLab</p>
      </Button>
    </>
  );
}

async function createGitHubApp({
  teamId,
  accessToken,
  setPopupState,
}: {
  teamId: string;
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

  const redirectUrl = env.NEXT_PUBLIC_SITE_URL + `/${teamId}/connect-git/connected/github`;

  if (!popup) {
    setPopupState("closed");
    alert("Popup was blocked. Please allow popups for this site.");
    return;
  }

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
    /* if () {
      clearInterval(interval);
      setPopupState("success");
      popup.close();
    } */
  }, 250);

  const res = await fetch(
    `${env.NEXT_PUBLIC_UNBIND_API_URL}/github/app/create?redirect_url=${redirectUrl}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal: abortController.signal,
    },
  );

  const resText = await res.text();
  popup.document.write(resText);
}
