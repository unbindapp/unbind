import {
  Block,
  BlockItem,
  BlockItemButtonLike,
  BlockItemContent,
  BlockItemDescription,
  BlockItemHeader,
  BlockItemTitle,
} from "@/components/block";
import { validatePositiveInteger } from "@/components/service/backups/backup-config";
import {
  hasApplying,
  stagedNumber,
  stagedString,
  useResetFormOnStagedChange,
  useServiceChanges,
} from "@/components/service/panel/content/deployed/settings/use-service-changes";
import ErrorWithWrapper from "@/components/settings/error-with-wrapper";
import { MiniSection } from "@/components/settings/mini-section";
import { settingsIds } from "@/components/settings/settings-ids";
import { SettingsSection } from "@/components/settings/settings-section";
import type { TServiceChangeField } from "@/components/staged-changes/types";
import { cn } from "@/components/ui/utils";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { TServiceShallow } from "@/lib/queries/services";
import { WalLevelSchema, type WalLevel } from "@/lib/server/client.gen";
import { useStore } from "@tanstack/react-form";
import { CopyIcon, DatabaseIcon, RssIcon } from "lucide-react";
import { useMemo } from "react";

type TProps = {
  service: TServiceShallow;
};

export default function DatabaseSection({ service }: TProps) {
  if (service.type !== "database" || service.database_type !== "postgres") {
    return <ErrorWithWrapper message="Unsupported service type" />;
  }

  return <PostgresSection service={service} />;
}

// The API treats 0 as unset, which leaves the PostgreSQL default in place
const defaultApiValue = 0;

type TNumberField = Extract<
  TServiceChangeField,
  "maxReplicationSlots" | "maxWalSenders" | "maxSlotWalKeepSizeMb"
>;

const numberFields: Record<
  TNumberField,
  { label: string; title?: string; unit: string; placeholder: string; unset: string; max?: number }
> = {
  maxReplicationSlots: {
    label: "Replication Slots",
    title: "Replication Slots",
    unit: "slots",
    placeholder: "10",
    unset: "Default",
    max: 1000,
  },
  maxWalSenders: {
    label: "WAL Senders",
    title: "WAL Senders",
    unit: "senders",
    placeholder: "10",
    unset: "Default",
    max: 1000,
  },
  maxSlotWalKeepSizeMb: {
    label: "Slot WAL keep size",
    unit: "MB",
    placeholder: "Unlimited",
    unset: "Unlimited",
  },
};

const numberFieldNames: TNumberField[] = [
  "maxReplicationSlots",
  "maxWalSenders",
  "maxSlotWalKeepSizeMb",
];
const databaseFields: TServiceChangeField[] = ["walLevel", ...numberFieldNames];

const walLevelItems = WalLevelSchema.options.map((level) => ({
  label: walLevelToName(level),
  value: level,
}));

function numberToInput(value: number) {
  return value === defaultApiValue ? "" : value.toString();
}

function numberToApi(value: string) {
  return value === "" ? defaultApiValue : Number(value);
}

function PostgresSection({ service }: { service: TServiceShallow }) {
  const sectionHighlightId = useMemo(() => getEntityId(service), [service]);
  const config = service.config.database_config;
  const serverWalLevel: WalLevel = config?.wal_level ?? "replica";
  const serverNumbers: Record<TNumberField, number> = {
    maxReplicationSlots: config?.max_replication_slots ?? defaultApiValue,
    maxWalSenders: config?.max_wal_senders ?? defaultApiValue,
    maxSlotWalKeepSizeMb: config?.max_slot_wal_keep_size_mb ?? defaultApiValue,
  };
  const { staged, stage, unstage } = useServiceChanges(service, {
    walLevel: serverWalLevel,
    ...serverNumbers,
  });

  const defaultValues = {
    walLevel: stagedString(staged.walLevel, serverWalLevel) as WalLevel,
    maxReplicationSlots: numberToInput(
      stagedNumber(staged.maxReplicationSlots, serverNumbers.maxReplicationSlots),
    ),
    maxWalSenders: numberToInput(stagedNumber(staged.maxWalSenders, serverNumbers.maxWalSenders)),
    maxSlotWalKeepSizeMb: numberToInput(
      stagedNumber(staged.maxSlotWalKeepSizeMb, serverNumbers.maxSlotWalKeepSizeMb),
    ),
  };
  const form = useAppForm({ defaultValues });
  useResetFormOnStagedChange(form, defaultValues, staged, databaseFields);

  const walLevel = useStore(form.store, (s) => s.values.walLevel);

  const stageNumber = (field: TNumberField, value: string) =>
    stage({
      field,
      label: numberFields[field].label,
      value: numberToApi(value),
      previous: serverNumbers[field],
      format: (v) =>
        v === defaultApiValue ? numberFields[field].unset : `${v} ${numberFields[field].unit}`,
    });

  const numberInput = (field: TNumberField) => (
    <form.AppField
      name={field}
      validators={{
        onChange: ({ value }) => validateNumberField(field, value),
      }}
      children={(fieldApi) => (
        <MiniSection
          title={numberFields[field].title}
          unit={numberFields[field].unit}
          hasChanges={staged[field] !== undefined}
        >
          <fieldApi.TextField
            field={fieldApi}
            value={fieldApi.state.value}
            onBlur={fieldApi.handleBlur}
            onChange={(e) => {
              fieldApi.handleChange(e.target.value);
              if (fieldApi.state.meta.errors.length > 0) return;
              stageNumber(field, e.target.value);
            }}
            placeholder={numberFields[field].placeholder}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            inputMode="numeric"
            className="min-w-0 flex-1"
            classNameInput="rounded-r-none"
          />
        </MiniSection>
      )}
    />
  );

  return (
    <SettingsSection
      title="Database"
      id="database"
      Icon={DatabaseIcon}
      entityId={sectionHighlightId}
      hasChanges={databaseFields.some((field) => staged[field] !== undefined)}
      isApplying={hasApplying(staged, databaseFields)}
      onDiscard={() => unstage(databaseFields)}
    >
      <Block>
        <BlockItem id={settingsIds.database.walLevel} className="w-full md:w-full">
          <BlockItemHeader type="column">
            <BlockItemTitle hasChanges={staged.walLevel !== undefined}>WAL Level</BlockItemTitle>
            <BlockItemDescription>
              The level of detail kept in the write-ahead log (WAL).
            </BlockItemDescription>
          </BlockItemHeader>
          <BlockItemContent>
            <form.AppField
              name="walLevel"
              children={(field) => (
                <field.AsyncDropdownMenu
                  dontCheckUntilSubmit
                  field={field}
                  value={field.state.value}
                  onChange={(v) => {
                    const level = v as WalLevel;
                    field.handleChange(level);
                    stage({
                      field: "walLevel",
                      label: "WAL level",
                      value: level,
                      previous: serverWalLevel,
                      format: walLevelToName,
                    });
                    // Slots, senders and the keep size only matter with logical subscribers
                    if (level !== "logical") unstage(numberFieldNames);
                  }}
                  items={walLevelItems}
                  ItemIcon={({ className, value }) => (
                    <WalLevelIcon className={cn(className, "size-4.5")} level={value} />
                  )}
                  isPending={false}
                  error={undefined}
                >
                  {({ isOpen }) => (
                    <BlockItemButtonLike
                      asElement="button"
                      text={walLevelToName(field.state.value)}
                      Icon={({ className }) => (
                        <WalLevelIcon
                          level={field.state.value}
                          className={cn(className, "size-4.5")}
                        />
                      )}
                      variant="outline"
                      open={isOpen}
                      onBlur={field.handleBlur}
                    />
                  )}
                </field.AsyncDropdownMenu>
              )}
            />
          </BlockItemContent>
        </BlockItem>
      </Block>
      {walLevel === "logical" && (
        <Block>
          <BlockItem id={settingsIds.database.replication} className="group/item w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle
                hasChanges={
                  staged.maxReplicationSlots !== undefined || staged.maxWalSenders !== undefined
                }
              >
                Replication
              </BlockItemTitle>
              <BlockItemDescription>
                Each subscriber and streaming replica uses one slot and one sender.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>
              <div className="flex w-full gap-3 pt-0.5">
                {numberInput("maxReplicationSlots")}
                {numberInput("maxWalSenders")}
              </div>
            </BlockItemContent>
          </BlockItem>
        </Block>
      )}
      {walLevel === "logical" && (
        <Block>
          <BlockItem id={settingsIds.database.slotWalKeepSize} className="w-full md:w-full">
            <BlockItemHeader type="column">
              <BlockItemTitle hasChanges={staged.maxSlotWalKeepSizeMb !== undefined}>
                Slot WAL Keep Size
              </BlockItemTitle>
              <BlockItemDescription>
                Caps the WAL kept for lagging replication slots.
              </BlockItemDescription>
            </BlockItemHeader>
            <BlockItemContent>{numberInput("maxSlotWalKeepSizeMb")}</BlockItemContent>
          </BlockItem>
        </Block>
      )}
    </SettingsSection>
  );
}

function WalLevelIcon({
  level,
  className,
}: {
  level: WalLevel | (string & {});
  className?: string;
}) {
  if (level === "logical") return <RssIcon className={className} />;
  return <CopyIcon className={className} />;
}

function walLevelToName(level: WalLevel | (string & {})) {
  if (level === "logical") return "Logical";
  if (level === "replica") return "Replica";
  return "Unknown";
}

function validateNumberField(field: TNumberField, value: string) {
  const error = validatePositiveInteger(value);
  if (error) return error;
  const max = numberFields[field].max;
  if (max !== undefined && Number(value) > max) {
    return { message: `Must be at most ${max}.` };
  }
  return undefined;
}

function getEntityId(service: TServiceShallow): string {
  return `database_${service.id}`;
}
