import { z } from "zod";

export const VariableTypeSchema = z.enum(["team", "project", "service"]);
export const VariableForCreateSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: "Name is required." })
      .refine((v) => !v.includes(" "), { message: "Name can't contain a space." }),
    value: z.string().min(1, { message: "Value is required." }),
  })
  .strip();

export type TVariableForCreate = z.infer<typeof VariableForCreateSchema>;
