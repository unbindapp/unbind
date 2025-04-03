import { z } from "zod";

export const teamNameMinLength = 3;
export const teamNameMaxLength = 32;
export const teamDescriptionMaxLength = 128;

export const TeamUpdateFormSchema = z
  .object({
    displayName: z
      .string()
      .min(teamNameMinLength, `Name should be at least ${teamNameMinLength} characters.`)
      .max(teamNameMaxLength, `Name should be at most ${teamNameMaxLength} characters.`),
    description: z
      .string()
      .max(
        teamDescriptionMaxLength,
        `Description should be at most ${teamDescriptionMaxLength} characters.`,
      ),
  })
  .strip();
