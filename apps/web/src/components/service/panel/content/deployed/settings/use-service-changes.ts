import { serviceChangesMatchingServer } from "@/components/staged-changes/reconcile";
import {
  useStagedChangesStore,
  useStagedServiceChanges,
  type TStagedServiceField,
} from "@/components/staged-changes/staged-changes-provider";
import {
  serviceChangeId,
  type TServiceChangeField,
  type TStagedServiceChange,
} from "@/components/staged-changes/types";
import { useService } from "@/components/service/service-provider";
import { TServiceShallow } from "@/lib/queries/services";
import { useCallback, useEffect, useRef } from "react";

export type TStagedFields = Partial<Record<TServiceChangeField, TStagedServiceField>>;
export type TServerValues = Partial<Record<TServiceChangeField, string | number>>;

type TStageInput<T extends string | number> = {
  field: TServiceChangeField;
  label: string;
  value: T;
  previous: T;
  format?: (value: T) => string;
};

// Settings sections stage edits against the server value instead of saving them.
// Staging the server value again clears the change.
export function useServiceChanges(service: TServiceShallow, serverValues: TServerValues) {
  const { teamId, projectId, environmentId } = useService();
  const staged = useStagedServiceChanges(service.id);
  const stageService = useStagedChangesStore((s) => s.stageService);
  const discard = useStagedChangesStore((s) => s.discard);

  // Changes the server already has, from a deploy that landed or another session, leave the stage
  const settledKey = serviceChangesMatchingServer(staged, serverValues).join(",");
  useEffect(() => {
    if (!settledKey) return;
    discard(settledKey.split(","));
  }, [settledKey, discard]);

  const stage = useCallback(
    <T extends string | number>({ field, label, value, previous, format }: TStageInput<T>) => {
      const display = format ?? String;
      stageService({
        teamId,
        projectId,
        environmentId,
        serviceId: service.id,
        serviceName: service.name,
        serviceIcon: service.config.icon,
        field,
        label,
        value,
        displayValue: display(value),
        displayPrevious: display(previous),
        isDefault: value === previous,
      });
    },
    [stageService, teamId, projectId, environmentId, service.id, service.name, service.config.icon],
  );

  const unstage = useCallback(
    (fields: TServiceChangeField[]) =>
      discard(fields.map((field) => serviceChangeId(service.id, field))),
    [discard, service.id],
  );

  return { staged, stage, unstage };
}

type TFormValues = Record<string, string | number>;

// Form defaults come from the staged values, so a discard elsewhere has to reset the
// form for the fields to show the server value again. Edits staged by this form
// already match the defaults and are left alone
export function useResetFormOnStagedChange<T extends TFormValues>(
  form: { reset: () => void; state: { values: T } },
  defaultValues: T,
  staged: TStagedFields,
  fields: TServiceChangeField[],
) {
  const key = fields
    .map((field) => {
      const change = staged[field];
      return change ? `${field}=${change.value}` : field;
    })
    .join("|");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (matchesDefaults(form.state.values, defaultValues)) return;
    form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function hasApplying(staged: TStagedFields, fields: TServiceChangeField[]) {
  return fields.some((field) => staged[field]?.isApplying === true);
}

function matchesDefaults<T extends TFormValues>(values: T, defaults: T) {
  return Object.keys(defaults).every((field) => values[field] === defaults[field]);
}

export function stagedNumber(change: TStagedServiceChange | undefined, fallback: number) {
  if (!change) return fallback;
  return typeof change.value === "number" ? change.value : Number(change.value);
}

export function stagedString(change: TStagedServiceChange | undefined, fallback: string) {
  if (!change) return fallback;
  return String(change.value);
}
