export function getWebhookIcon(urlStr: string): "discord" | "telegram" | "slack" | "webhook" {
  let parsedURL: URL;

  try {
    parsedURL = new URL(urlStr);

    if (!parsedURL.protocol || !parsedURL.host) {
      return "webhook";
    }
  } catch {
    return "webhook";
  }

  // Discord
  if (parsedURL.host === "discord.com" || parsedURL.host === "discordapp.com") {
    if (parsedURL.pathname.startsWith("/api/webhooks/")) {
      return "discord";
    }
  }

  // Slack
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

  // * Telgram
  // Example: https://api.telegram.org/bot1221212:dasdasd78dsdsa67das78/sendMessage?chat_id=156481231
  if (parsedURL.host === "api.telegram.org" && parsedURL.searchParams.has("chat_id")) {
    // Check for bot token in the path
    const pathSegments = parsedURL.pathname.split("/").filter((segment) => segment.length > 0);
    for (const segment of pathSegments) {
      if (segment.startsWith("bot")) {
        return "telegram";
      }
    }
  }

  // Default
  return "webhook";
}
