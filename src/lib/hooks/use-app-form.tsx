import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFormHook, createFormHookContexts } from "@tanstack/react-form";

const { fieldContext, formContext } = createFormHookContexts();

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField: Input,
    NumberField: Input,
  },
  formComponents: {
    SubmitButton: Button,
  },
  fieldContext,
  formContext,
});
