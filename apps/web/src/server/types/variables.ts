import { VariableReferenceInputItemSchema } from "@/server/client.gen";
import type {
  AvailableVariableReference,
  VariableReferenceResponse,
  VariableResponseItem,
} from "@/server/client.gen";
import { z } from "zod";

export const VariableForCreateValueSchema = z.string().nonempty("Value is required.");
export const VariableForCreateNameSchema = z
  .string()
  .nonempty("Name is required.")
  .refine((n) => !n.includes(" "), "Name can't contain spaces.");

export const VariableForCreateSchema = z.object({
  name: VariableForCreateNameSchema,
  value: VariableForCreateValueSchema,
});

export type TVariableForCreate = z.infer<typeof VariableForCreateSchema>;

export const VariableReferenceForCreateSchema = VariableReferenceInputItemSchema;
export type TVariableReferenceForCreate = z.infer<typeof VariableReferenceForCreateSchema>;

export type TVariableShallow = VariableResponseItem;
export type TVariableReferenceShallow = VariableReferenceResponse;
export type TVariableReferenceShallowSource = TVariableReferenceShallow["sources"][number];

export type TAvailableVariableReference = AvailableVariableReference;
