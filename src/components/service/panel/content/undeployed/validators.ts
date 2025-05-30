import {
  TVariableForCreate,
  VariableForCreateNameSchema,
  VariableForCreateValueSchema,
} from "@/server/trpc/api/variables/types";

export function softValidateVariables(variables: TVariableForCreate[]) {
  const cleanedVariables = variables
    .map((v, i) => ({
      variable: { name: v.name, value: v.value },
      index: i,
    }))
    .filter((v) => v.variable.name !== "" || v.variable.value !== "");

  const errorMap: Record<string, { message: string }> = {};
  const validVariables: TVariableForCreate[] = [];

  if (cleanedVariables.length > 0) {
    cleanedVariables.forEach(({ variable, index }) => {
      let isValid = true;

      const nameResult = VariableForCreateNameSchema.safeParse(variable.name);
      if (!nameResult.success) {
        isValid = false;
        errorMap[`variables[${index}].name`] = {
          message: nameResult.error.errors[0].message,
        };
      }

      const valueResult = VariableForCreateValueSchema.safeParse(variable.value);
      if (!valueResult.success) {
        isValid = false;
        errorMap[`variables[${index}].value`] = {
          message: valueResult.error.errors[0].message,
        };
      }

      if (isValid) validVariables.push(variable);
    });
  }
  return { validVariables, errorMap: Object.keys(errorMap).length > 0 ? errorMap : null };
}
