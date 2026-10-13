import {
  clientIpHeaderFields,
  stagedString,
  type TStagedFields,
  useResetFormOnStagedChange,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { useAppForm } from "@/lib/hooks/use-app-form";

// The API treats "" as unset, which picks the header on its own
export const automaticClientIpHeader = "";
const headerNamePattern = /^[A-Za-z0-9-]*$/;

type TProps = {
  serverHeader: string;
  staged: TStagedFields;
  stage: (header: string) => void;
  revert: () => void;
};

export default function ClientIPHeader({ serverHeader, staged, stage, revert }: TProps) {
  const defaultValues = { header: stagedString(staged.clientIpHeader, serverHeader) };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, clientIpHeaderFields);

  return (
    <form.AppField
      name="header"
      validators={{ onChange: ({ value }) => validateHeaderName(value) }}
      children={(field) => (
        <field.TextField
          field={field}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => {
            field.handleChange(e.target.value);
            if (field.state.meta.errors.length > 0) return;
            stage(e.target.value.trim());
          }}
          placeholder="Automatic"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck="false"
          revertTo={serverHeader}
          onRevert={() => {
            field.handleChange(serverHeader);
            revert();
          }}
          hasChanges={staged.clientIpHeader !== undefined}
        />
      )}
    />
  );
}

function validateHeaderName(value: string) {
  if (headerNamePattern.test(value.trim())) return undefined;
  return { message: "Use letters, digits and dashes, like CF-Connecting-IP." };
}
