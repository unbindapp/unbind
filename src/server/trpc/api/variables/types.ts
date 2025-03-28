import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

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

export type TVariableShallow = AppRouterOutputs["variables"]["list"]["variables"][number];
