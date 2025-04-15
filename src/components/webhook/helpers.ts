export function getWebhookIcon(urlStr: string): "discord" | "slack" | "webhook" {
  try {
    const parsedURL = new URL(urlStr);

    if (parsedURL.host === "discord.com" || parsedURL.host === "discordapp.com") {
      // Check if the path matches the webhook pattern
      if (parsedURL.pathname.startsWith("/api/webhooks/")) {
        return "discord";
      }
    }

    // Regular Slack webhooks
    if (parsedURL.host.endsWith(".slack.com") && parsedURL.pathname.includes("/services/")) {
      return "slack";
    }

    // Slack API webhooks
    if (parsedURL.host === "hooks.slack.com" && parsedURL.pathname.startsWith("/services/")) {
      return "slack";
    }

    // Match Slack webhook URL patterns
    // Example: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
    const slackRegex = /^https:\/\/[^/]+\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/;
    if (slackRegex.test(urlStr)) {
      return "slack";
    }

    return "webhook";
  } catch {
    return "webhook";
  }
}
