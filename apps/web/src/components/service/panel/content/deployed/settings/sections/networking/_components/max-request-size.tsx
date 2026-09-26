import { validatePositiveInteger } from "@/components/service/backups/backup-config";
import {
  requestSizeFields,
  stagedNumber,
  type TStagedFields,
  useResetFormOnStagedChange,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { DraftInput } from "@/components/settings/draft-input";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { FileUpIcon } from "lucide-react";

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
  const baseline = toInput(stagedNumber(staged.maxRequestBodySizeMb, serverSizeMb));
  const defaultValues = { sizeMb: baseline };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, requestSizeFields);

  return (
    <form.AppField
      name="sizeMb"
      children={(field) => (
        <DraftInput
          value={field.state.value}
          onChange={field.handleChange}
          onBlur={field.handleBlur}
          baseline={baseline}
          revertTo={toInput(serverSizeMb)}
          getError={getRequestSizeError}
          onConfirm={(value) => stage(value === "" ? unsetRequestSizeMb : Number(value))}
          onRevert={() => stage(serverSizeMb)}
          Icon={FileUpIcon}
          placeholder={defaultRequestSizeMb.toString()}
          inputMode="numeric"
          unit="MB"
        />
      )}
    />
  );
}

function toInput(sizeMb: number) {
  return sizeMb === unsetRequestSizeMb ? "" : sizeMb.toString();
}

function getRequestSizeError(value: string) {
  const error = validatePositiveInteger(value);
  if (error) return error.message;
  if (Number(value) > maxRequestSizeMb) return `Must be at most ${maxRequestSizeMb}.`;
  return null;
}
