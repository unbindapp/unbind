export function getWebhookIcon(url: string) {
  if (url.includes("discord.com")) return "discord";
  if (url.includes("slack.com")) return "slack";
  return "webhook";
}
