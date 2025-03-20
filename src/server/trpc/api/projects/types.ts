import { z } from "zod";

export const ProjectUpdateFormSchema = z.object({
  displayName: z.string().min(3).max(24),
  description: z.string().min(3).max(128),
});
