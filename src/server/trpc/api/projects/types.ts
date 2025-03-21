import { z } from "zod";

export const projectNameMinLength = 3;
export const projectNameMaxLength = 32;
export const projectDescriptionMaxLength = 128;

export const ProjectUpdateFormSchema = z.object({
  displayName: z
    .string()
    .min(projectNameMinLength, `Name should be at least ${projectNameMinLength} characters.`)
    .max(projectNameMaxLength, `Name should be at most ${projectNameMaxLength} characters.`),
  description: z
    .string()
    .max(
      projectDescriptionMaxLength,
      `Description should be at most ${projectDescriptionMaxLength} characters.`,
    ),
});
