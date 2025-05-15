import { z } from "zod";

export const templateGroupNameMinLength = 2;
export const templateGroupNameMaxLength = 32;
export const templateGroupDescriptionMaxLength = 128;

export const TemplateGroupNameSchema = z
  .string()
  .min(
    templateGroupNameMinLength,
    `Name should be at least ${templateGroupNameMinLength} characters.`,
  )
  .max(
    templateGroupNameMaxLength,
    `Name should be at most ${templateGroupNameMaxLength} characters.`,
  );

export const TemplateGroupDescriptionSchema = z
  .string()
  .max(
    templateGroupDescriptionMaxLength,
    `Description should be at most ${templateGroupDescriptionMaxLength} characters.`,
  );
