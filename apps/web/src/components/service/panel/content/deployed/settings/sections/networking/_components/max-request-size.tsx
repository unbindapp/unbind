import { validatePositiveInteger } from "@/components/service/backups/backup-config";
import {
  requestSizeFields,
  stagedNumber,
  type TStagedFields,
  useResetFormOnStagedChange,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { useAppForm } from "@/lib/hooks/use-app-form";

// The API treats 0 as unset, which applies the default
export const unsetRequestSizeMb = 0;
const defaultRequestSizeMb = 100;
const maxRequestSizeMb = 10240;

type TProps = {
  serverSizeMb: number;
  staged: TStagedFields;
  stage: (sizeMb: number) => void;
  revert: () => void;
};

export default function MaxRequestSize({ serverSizeMb, staged, stage, revert }: TProps) {
  const defaultValues = {
    sizeMb: toInput(stagedNumber(staged.maxRequestBodySizeMb, serverSizeMb)),
  };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, requestSizeFields);
  const serverInput = toInput(serverSizeMb);

  return (
    <form.AppField
      name="sizeMb"
      validators={{ onChange: ({ value }) => validateRequestSize(value) }}
      children={(field) => (
        <field.TextField
          field={field}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => {
            field.handleChange(e.target.value);
            if (field.state.meta.errors.length > 0) return;
            stage(e.target.value === "" ? unsetRequestSizeMb : Number(e.target.value));
          }}
          placeholder={defaultRequestSizeMb.toString()}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          inputMode="numeric"
          unit="MB"
          revertTo={serverInput}
          onRevert={() => {
            field.handleChange(serverInput);
            revert();
          }}
          hasChanges={staged.maxRequestBodySizeMb !== undefined}
        />
      )}
    />
  );
}

function toInput(sizeMb: number) {
  return sizeMb === unsetRequestSizeMb ? "" : sizeMb.toString();
}

function validateRequestSize(value: string) {
  const error = validatePositiveInteger(value);
  if (error) return error;
  if (Number(value) > maxRequestSizeMb) {
    return { message: `Must be at most ${maxRequestSizeMb}.` };
  }
  return undefined;
}
