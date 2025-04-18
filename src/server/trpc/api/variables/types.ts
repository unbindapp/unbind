import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export const VariableForCreateValueSchema = z.string().min(1, { message: "Value is required." });

export const VariableForCreateSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: "Name is required." })
      .refine((v) => !v.includes(" "), { message: "Name can't contain a space." }),
    value: VariableForCreateValueSchema,
  })
  .strip();

export type TVariableForCreate = z.infer<typeof VariableForCreateSchema>;

export type TVariableShallow = AppRouterOutputs["variables"]["list"]["variables"]["items"][number];
