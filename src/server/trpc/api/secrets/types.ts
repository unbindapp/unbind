import { z } from "zod";

export const SecretTypeSchema = z.enum(["team", "project", "service"]);
export const SecretSchema = z.object({
  name: z.string().refine((v) => !v.includes(" "), { message: "Name can't contain a space." }),
  value: z.string(),
});

export type TSecret = z.infer<typeof SecretSchema>;
