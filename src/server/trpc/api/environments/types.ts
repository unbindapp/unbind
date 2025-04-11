import { z } from "zod";

export const environmentNameMinLength = 2;
export const environmentNameMaxLength = 32;

export const CreateEnvironmentFormNameSchema = z
  .string()
  .min(environmentNameMinLength, `Name should be at least ${environmentNameMinLength} characters.`)
  .max(environmentNameMaxLength, `Name should be at most ${environmentNameMaxLength} characters.`);
