import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export const projectNameMinLength = 2;
export const projectNameMaxLength = 32;
export const projectDescriptionMaxLength = 128;

export const ProjectUpdateFormSchema = z
  .object({
    name: z
      .string()
      .min(projectNameMinLength, `Name should be at least ${projectNameMinLength} characters.`)
      .max(projectNameMaxLength, `Name should be at most ${projectNameMaxLength} characters.`),
    description: z
      .string()
      .max(
        projectDescriptionMaxLength,
        `Description should be at most ${projectDescriptionMaxLength} characters.`,
      ),
  })
  .strip();

export type TProjectShallow = AppRouterOutputs["projects"]["list"]["projects"][number];
