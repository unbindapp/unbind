import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import {
  NetworkAccessIcon,
  networkAccessItems,
  networkAccessLabel,
  networkAccessValue,
  publicValue,
} from "@/components/service/network-access";
import { useSettingsSectionSearch } from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import {
  hasApplying,
  stagedBoolean,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import { settingsIds } from "@/components/settings/settings-ids";
import { SettingsSection } from "@/components/settings/settings-section";
import type { TServiceChangeField } from "@/components/staged-changes/types";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/lib/queries/services";
import { GlobeLockIcon } from "lucide-react";
import { useMemo } from "react";

const networkAccessFields: TServiceChangeField[] = ["isPublic"];

type TProps = {
  service: TServiceShallow;
};

export default function NetworkAccessSection({ service }: TProps) {
  const { isSectionVisible } = useSettingsSectionSearch("network-access");
  if (!isSectionVisible) return null;
  return <Section service={service} />;
}

function Section({ service }: TProps) {
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);
  const serverIsPublic = service.config.is_public;
  const { staged, stage, unstage } = useServiceChanges(service, { isPublic: serverIsPublic });

  const defaultValues = { isPublic: stagedBoolean(staged.isPublic, serverIsPublic) };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, networkAccessFields);

  return (
    <SettingsSection
      title="Network Access"
      id="network-access"
      Icon={GlobeLockIcon}
      entityId={sectionHighlightId}
      hasChanges={staged.isPublic !== undefined}
      isApplying={hasApplying(staged, networkAccessFields)}
      onDiscard={() => unstage(networkAccessFields)}
    >
      <Block>
        <BlockItem id={settingsIds.networkAccess.access} className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle>Network Access</BlockItemTitle>
            <BlockItemDescription>
              Who can reach the database. Private keeps it inside the cluster.
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent>
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
                    stage({
                      field: "isPublic",
                      label: "Network access",
                      value: isPublic,
                      previous: serverIsPublic,
                      format: (value) => networkAccessLabel(value),
                    });
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
          </BlockItemContent>
        </BlockItem>
      </Block>
    </SettingsSection>
  );
}

function getEntityId(service: TServiceShallow): string {
  return `network-access_${service.id}`;
}
