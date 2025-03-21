import { z } from "zod";

export const SecretTypeSchema = z.enum(["team", "project", "service"]);
export const SecretSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export type TSecret = z.infer<typeof SecretSchema>;
