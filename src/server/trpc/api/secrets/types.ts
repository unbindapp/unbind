import { z } from "zod";

export const SecretTypeSchema = z.enum(["team", "project", "service"]);
export const SecretSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required." })
    .refine((v) => !v.includes(" "), { message: "Name can't contain a space." }),
  value: z.string().min(1, { message: "Value is required." }),
});

export type TSecret = z.infer<typeof SecretSchema>;
