import { ItemSchema, VariableReferenceInputItemSchema } from "@/server/go/client.gen";
import { AppRouterOutputs } from "@/server/trpc/api/root";
import { z } from "zod";

export const VariableForCreateValueSchema = ItemSchema.shape.value.refine(
  (value) => value.length >= 1,
  { message: "Value is required." },
);

export const VariableForCreateSchema = ItemSchema.refine(({ name }) => name.length >= 1, {
  message: "Name is required.",
})
  .refine(({ name }) => !name.includes(" "), { message: "Name can't contain a space." })
  .refine(({ value }) => value.length >= 1, { message: "Value is required." });

export type TVariableForCreate = z.infer<typeof VariableForCreateSchema>;

export const VariableReferenceForCreateSchema = VariableReferenceInputItemSchema;
export type TVariableReferenceForCreate = z.infer<typeof VariableReferenceForCreateSchema>;

export type TVariableShallow = AppRouterOutputs["variables"]["list"]["variables"][number];
export type TVariableReferenceShallow =
  AppRouterOutputs["variables"]["list"]["variable_references"][number];
export type TVariableReferenceShallowSource = TVariableReferenceShallow["sources"][number];

export type TAvailableVariableReference =
  AppRouterOutputs["variables"]["listAvailableVariableReferences"]["variables"][number];
