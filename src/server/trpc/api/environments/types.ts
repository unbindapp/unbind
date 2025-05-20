import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export const environmentNameMinLength = 2;
export const environmentNameMaxLength = 32;
export const environmentDescriptionMaxLength = 128;

export const EnvironmentNameSchema = z
  .string()
  .min(environmentNameMinLength, `Name should be at least ${environmentNameMinLength} characters.`)
  .max(environmentNameMaxLength, `Name should be at most ${environmentNameMaxLength} characters.`);

export const EnvironmentDescriptionSchema = z
  .string()
  .max(
    environmentDescriptionMaxLength,
    `Description should be at most ${environmentDescriptionMaxLength} characters.`,
  );

export const EnvironmentRenameSchema = z.object({
  name: EnvironmentNameSchema,
  description: EnvironmentDescriptionSchema,
});

export type TEnvironmentShallow = AppRouterOutputs["environments"]["list"]["environments"][number];
