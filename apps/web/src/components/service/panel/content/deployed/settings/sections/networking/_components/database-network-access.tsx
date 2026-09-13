import { BlockItemButtonLike } from "@/components/block";
import {
  NetworkAccessIcon,
  networkAccessItems,
  networkAccessLabel,
  networkAccessValue,
  publicValue,
} from "@/components/service/network-access";
import {
  networkAccessFields,
  type TStagedFields,
  useResetFormOnStagedChange,
  stagedBoolean,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/lib/queries/services";

type TProps = {
  service: TServiceShallow;
  staged: TStagedFields;
  stage: (isPublic: boolean) => void;
};

export default function DatabaseNetworkAccess({ service, staged, stage }: TProps) {
  const serverIsPublic = service.config.is_public;
  const defaultValues = { isPublic: stagedBoolean(staged.isPublic, serverIsPublic) };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, networkAccessFields);

  return (
    <form.AppField
      name="isPublic"
      children={(field) => (
        <field.AsyncDropdownMenu
          dontCheckUntilSubmit
          field={field}
          value={networkAccessValue(field.state.value)}
          onChange={(v) => {
            const isPublic = v === publicValue;
            field.handleChange(isPublic);
            stage(isPublic);
          }}
          items={networkAccessItems}
          ItemIcon={({ className, value }) => (
            <NetworkAccessIcon isPublic={value === publicValue} className={className} />
          )}
          isPending={false}
          error={undefined}
        >
          {({ isOpen }) => (
            <BlockItemButtonLike
              asElement="button"
              text={networkAccessLabel(field.state.value)}
              Icon={({ className }) => (
                <NetworkAccessIcon isPublic={field.state.value} className={className} />
              )}
              variant="outline"
              open={isOpen}
              onBlur={field.handleBlur}
              hasChanges={staged.isPublic !== undefined}
            />
          )}
        </field.AsyncDropdownMenu>
      )}
    />
  );
}
