import { validatePositiveInteger } from "@/components/service/backups/backup-config";
import {
  requestSizeFields,
  stagedNumber,
  type TStagedFields,
  useResetFormOnStagedChange,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { MiniSection } from "@/components/settings/mini-section";
import { useAppForm } from "@/lib/hooks/use-app-form";

// The API treats 0 as unset, which applies the default
export const unsetRequestSizeMb = 0;
const defaultRequestSizeMb = 100;
const maxRequestSizeMb = 10240;

type TProps = {
  serverSizeMb: number;
  staged: TStagedFields;
  stage: (sizeMb: number) => void;
};

export default function MaxRequestSize({ serverSizeMb, staged, stage }: TProps) {
  const sizeMb = stagedNumber(staged.maxRequestBodySizeMb, serverSizeMb);
  const defaultValues = { sizeMb: sizeMb === unsetRequestSizeMb ? "" : sizeMb.toString() };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, requestSizeFields);

  return (
    <form.AppField
      name="sizeMb"
      validators={{ onChange: ({ value }) => validateRequestSize(value) }}
      children={(field) => (
        <MiniSection unit="MB" hasChanges={staged.maxRequestBodySizeMb !== undefined}>
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
            className="min-w-0 flex-1"
            classNameInput="rounded-r-none"
            hasChanges={staged.maxRequestBodySizeMb !== undefined}
          />
        </MiniSection>
      )}
    />
  );
}

function validateRequestSize(value: string) {
  const error = validatePositiveInteger(value);
  if (error) return error;
  if (Number(value) > maxRequestSizeMb) {
    return { message: `Must be at most ${maxRequestSizeMb}.` };
  }
  return undefined;
}
