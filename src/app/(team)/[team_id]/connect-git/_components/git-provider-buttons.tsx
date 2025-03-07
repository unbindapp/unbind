"use client";

import GitProviderIcon from "@/components/icons/git-provider";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";
import { Session } from "next-auth";

type TProps = {
  teamId: string;
  session: Session;
};

export default function GitProviderButtons({ teamId, session }: TProps) {
  const { mutate: onGitHubClick, isPending: isGitHubPending } = useMutation({
    mutationFn: async () => createGitHubApp({ teamId, accessToken: session.access_token }),
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

async function createGitHubApp({ teamId, accessToken }: { teamId: string; accessToken: string }) {
  const width = 800;
  const height = 600;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;
  const popup = window.open(
    "",
    "GitHubAuth",
    `width=${width},height=${height},top=${top},left=${left}`,
  );

  if (!popup) {
    alert("Popup was blocked. Please allow popups for this site.");
    return;
  }

  const res = await fetch("https://api.unbind.app/github/app/create", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const resText = await res.text();
  console.log(resText);
  popup.document.write(resText);
}
