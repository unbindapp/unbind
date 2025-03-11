import { z } from "zod";

const OwnerSchema = z.object({
  avatar_url: z.string(),
  id: z.number(),
  login: z.string(),
  name: z.string(),
});

const RepositorySchema = z.object({
  clone_url: z.string(),
  full_name: z.string(),
  homepage: z.string(),
  html_url: z.string(),
  id: z.number(),
  owner: OwnerSchema,
});

export const RepositoriesResultSchema = z.object({
  data: z.array(RepositorySchema),
});
