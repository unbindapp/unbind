"use client";

import GitProviderIcon from "@/components/icons/git-provider";
import { Button } from "@/components/ui/button";
import { AppRouterInputs, AppRouterOutputs } from "@/server/trpc/api/root";
import { api } from "@/server/trpc/setup/client";
import { useMutation } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";

type TProps = {
  teamId: string;
};

export default function GitProviderButtons({ teamId }: TProps) {
  const { mutateAsync: createGitHubManifest } = api.github.createManifest.useMutation();
  const { mutateAsync: connectGitHubApp } = api.github.connectApp.useMutation();

  const { mutate: onGitHubClick, isPending: isGitHubPending } = useMutation({
    mutationFn: async () => createGitHubApp({ teamId, createGitHubManifest, connectGitHubApp }),
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
  createGitHubManifest,
  connectGitHubApp,
}: {
  teamId: string;
  createGitHubManifest: (
    props: AppRouterInputs["github"]["createManifest"],
  ) => Promise<AppRouterOutputs["github"]["createManifest"]>;
  connectGitHubApp: (
    props: AppRouterInputs["github"]["connectApp"],
  ) => Promise<AppRouterOutputs["github"]["connectApp"]>;
}) {
  const { data } = await createGitHubManifest({
    teamId,
    redirectUrl: window.location.href + "/connecting/github",
  });

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

  // Create a form in the popup window
  const form = popup.document.createElement("form");
  form.method = "post";
  form.action = data.post_url;
  form.style.display = "none";

  const input = popup.document.createElement("input");
  input.name = "manifest";
  input.type = "text";
  input.value = JSON.stringify(data.manifest);

  form.appendChild(input);
  popup.document.body.appendChild(form);

  console.log("Submitting form to GitHub with manifest:", data.manifest);

  form.submit();

  const githubCode = await new Promise<string>((resolve) => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data.code) {
        resolve(event.data.code);
        window.removeEventListener("message", handleMessage);
      }
    }
    window.addEventListener("message", handleMessage);
  });

  popup.close();

  // Use the received code to connect the GitHub app.
  const connectResult = await connectGitHubApp({ teamId, code: githubCode });
  console.log("Connected GitHub app:", connectResult);
  return connectResult;
}
