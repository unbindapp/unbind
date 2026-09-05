import {
  useStagedChangesStore,
  useStagedServiceChanges,
} from "@/components/staged-changes/staged-changes-provider";
import {
  serviceChangeId,
  type TServiceChangeField,
  type TStagedServiceChange,
} from "@/components/staged-changes/types";
import { useService } from "@/components/service/service-provider";
import { TServiceShallow } from "@/lib/queries/services";
import { useCallback, useEffect, useRef } from "react";

export type TStagedFields = Partial<Record<TServiceChangeField, TStagedServiceChange>>;

type TStageInput<T extends string | number> = {
  field: TServiceChangeField;
  label: string;
  value: T;
  previous: T;
  format?: (value: T) => string;
};

// Settings sections stage edits against the server value instead of saving them.
// Staging the server value again clears the change.
export function useServiceChanges(service: TServiceShallow) {
  const { teamId, projectId, environmentId } = useService();
  const staged = useStagedServiceChanges(service.id);
  const stageService = useStagedChangesStore((s) => s.stageService);
  const discard = useStagedChangesStore((s) => s.discard);

  const stage = useCallback(
    <T extends string | number>({ field, label, value, previous, format }: TStageInput<T>) => {
      const display = format ?? String;
      stageService({
        teamId,
        projectId,
        environmentId,
        serviceId: service.id,
        serviceName: service.name,
        field,
        label,
        value,
        displayValue: display(value),
        displayPrevious: display(previous),
        isDefault: value === previous,
      });
    },
    [stageService, teamId, projectId, environmentId, service.id, service.name],
  );

  const unstage = useCallback(
    (fields: TServiceChangeField[]) =>
      discard(fields.map((field) => serviceChangeId(service.id, field))),
    [discard, service.id],
  );

  return { staged, stage, unstage };
}

// Form defaults come from the staged values, so a discard elsewhere has to reset the
// form for the fields to show the server value again
export function useResetFormOnStagedChange(
  form: { reset: () => void },
  staged: TStagedFields,
  fields: TServiceChangeField[],
) {
  const key = fields.map((field) => `${field}=${staged[field]?.value ?? ""}`).join("|");
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    form.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export function stagedNumber(change: TStagedServiceChange | undefined, fallback: number) {
  if (!change) return fallback;
  return typeof change.value === "number" ? change.value : Number(change.value);
}

export function stagedString(change: TStagedServiceChange | undefined, fallback: string) {
  if (!change) return fallback;
  return String(change.value);
}
