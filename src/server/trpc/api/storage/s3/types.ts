import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export type TS3SourceShallow = AppRouterOutputs["storage"]["s3"]["list"]["sources"][number];

export const s3SourceNameMinLength = 2;
export const s3SourceNameMaxLength = 32;

export const CreateS3SourceFormSchema = z.object({
  name: z
    .string()
    .min(s3SourceNameMinLength, `Name should be at least ${s3SourceNameMinLength} characters.`)
    .max(s3SourceNameMaxLength, `Name should be at most ${s3SourceNameMaxLength} characters.`),
  endpoint: z.string().url("Endpoint must be a valid URL."),
  accessKeyId: z.string().min(1, "Access Key ID is required."),
  secretKey: z.string().min(1, "Secret Key is required."),
  region: z.string().min(1, "Region is required."),
});
