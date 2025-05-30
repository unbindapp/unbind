import { VariableReferenceInputItemSchema } from "@/server/go/client.gen";
import { AppRouterOutputs } from "@/server/trpc/api/root";
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

export type TVariableShallow = AppRouterOutputs["variables"]["list"]["variables"][number];
export type TVariableReferenceShallow =
  AppRouterOutputs["variables"]["list"]["variable_references"][number];
export type TVariableReferenceShallowSource = TVariableReferenceShallow["sources"][number];

export type TAvailableVariableReference =
  AppRouterOutputs["variables"]["listAvailableVariableReferences"]["variables"][number];
