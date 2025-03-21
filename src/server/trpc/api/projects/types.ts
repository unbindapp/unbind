import { z } from "zod";

export const ProjectUpdateFormSchema = z.object({
  displayName: z
    .string()
    .min(3, "Name should be at least 3 characters.")
    .max(24, "Name should be at most 24 characters."),
  description: z.string().max(128, "Description should be at most 128 characters."),
});
