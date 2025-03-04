import { z } from "zod";

export const SGithubCreateManifestResponseBody = z.object({
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
      secret: z.string(),
      url: z.string(),
    }),
    name: z.string(),
    public: z.boolean(),
    redirect_url: z.string(),
    url: z.string(),
  }),
  post_url: z.string(),
});

export type TGithubCreateManifestResponseBody = z.infer<typeof SGithubCreateManifestResponseBody>;
