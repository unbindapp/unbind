"use client";

import GitProviderIcon from "@/components/icons/git-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/server/trpc/setup/client";

type TProps = {
  teamId: string;
};

export default function GitProviderButtons({ teamId }: TProps) {
  const { mutateAsync: createGitHubManifest } = api.main.createGitHubManifest.useMutation();
  const onGitHubClick = async () => {
    const { data } = await createGitHubManifest({ teamId, redirectUrl: window.location.href });

    // TO-DO fix this after API is fixed
    const manifest: (typeof data)["manifest"] = {
      default_events: data.manifest.default_events.filter((event) => event !== "pull_request"),
      default_permissions: data.manifest.default_permissions,
      description: data.manifest.description,
      // @ts-expect-error this is fine
      hook_attributes: {
        url: data.manifest.hook_attributes.url,
      },
      name: data.manifest.name,
      public: data.manifest.public,
      redirect_url: data.manifest.redirect_url,
      url: data.manifest.url,
    };
    //////////////////////////////////////////

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
    input.value = JSON.stringify(manifest);

    form.appendChild(input);
    popup.document.body.appendChild(form);

    console.log("Submitting form to GitHub with manifest:", manifest);

    form.submit();
  };

  return (
    <>
      <Button onClick={onGitHubClick} variant="github" className="px-11">
        <GitProviderIcon
          className="absolute top-1/2 left-5.75 size-6 -translate-1/2"
          variant="github"
        />
        <p className="min-w-0 shrink">Continue with GitHub</p>
      </Button>
      <Button variant="gitlab" className="px-11">
        <GitProviderIcon
          className="absolute top-1/2 left-5.75 size-6 -translate-1/2"
          variant="gitlab"
        />
        <p className="min-w-0 shrink">Continue with GitLab</p>
      </Button>
    </>
  );
}
