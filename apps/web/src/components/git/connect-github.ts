import { toast } from "@/components/ui/toast";
import { getGoClient } from "@/lib/server/client";

export function githubConnectedPath() {
  return "/connect-git/connected/github";
}

type TConnectGitHubInput = {
  redirectUrl: string;
  organizationName?: string;
  // The team whose members may pick the repositories, omitted keeps them to the connecting user
  teamId?: string;
  onSuccess: () => void;
};

// Opens the GitHub app creation flow in a popup. Must run inside a user gesture,
// otherwise the browser blocks the popup.
export async function connectGitHub({
  redirectUrl,
  organizationName,
  teamId,
  onSuccess,
}: TConnectGitHubInput) {
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

  if (!popup) {
    toast.add({ type: "error", title: "Popup was blocked. Please allow popups for this site." });
    return;
  }

  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.success === true) {
      clearInterval(interval);
      onSuccess();
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
    }
  }, 250);

  const res = await getGoClient().github.app.create(
    { redirect_url: redirectUrl, organization: organizationName, team_id: teamId },
    { signal: abortController.signal },
  );
  popup.document.write(res.data);
}
