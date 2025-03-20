import { z } from "zod";

export const ProjectUpdateFormSchema = z.object({
  displayName: z
    .string()
    .min(3, "Name should be at least 3 characters long.")
    .max(24, "Name should be at most 24 characters long."),
  description: z
    .string()
    .min(3, "Description should be at least 3 characters long.")
    .max(128, "Description should be at most 128 characters long."),
});
