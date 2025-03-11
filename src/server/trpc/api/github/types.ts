import { z } from "zod";

export const GitHubCreateManifestResponseSchema = z.object({
  $schema: z.string(),
  manifest: z.object({
    default_events: z.array(z.string()),
    default_permissions: z.object({
      contents: z.string(),
      issues: z.string(),
      metadata: z.string(),
    }),
    description: z.string(),
    hook_attributes: z.object({
      url: z.string(),
    }),
    name: z.string(),
    public: z.boolean(),
    redirect_url: z.string(),
    url: z.string(),
  }),
  post_url: z.string(),
});

export type TGitHubCreateManifestResponse = z.infer<typeof GitHubCreateManifestResponseSchema>;

export const GitHubConnectAppResponseSchema = z.object({
  $schema: z.string(),
  name: z.string(),
});

export type TGitHubConnectAppResponse = z.infer<typeof GitHubConnectAppResponseSchema>;
