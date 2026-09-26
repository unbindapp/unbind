import {
  listChangesMatchingServer,
  serviceChangesMatchingServer,
} from "@/components/staged-changes/reconcile";
import {
  useStagedChangesStore,
  useStagedListChanges,
  useStagedServiceChanges,
  type TStagedServiceField,
} from "@/components/staged-changes/staged-changes-provider";
import {
  serviceChangeId,
  type THostTarget,
  type TServiceChangeField,
  type TStagedServiceChange,
} from "@/components/staged-changes/types";
import { useService } from "@/components/service/service-provider";
import { TServiceShallow } from "@/lib/queries/services";
import { useCallback, useEffect, useMemo, useRef } from "react";

export type TStagedFields = Partial<Record<TServiceChangeField, TStagedServiceField>>;

export const networkAccessFields: TServiceChangeField[] = ["isPublic"];
export const requestSizeFields: TServiceChangeField[] = ["maxRequestBodySizeMb"];
export type TServerValues = Partial<Record<TServiceChangeField, string | number | boolean>>;

type TStageInput<T extends string | number | boolean> = {
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
    <T extends string | number | boolean>({
      field,
      label,
      value,
      previous,
      format,
    }: TStageInput<T>) => {
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

// Domains and ports are staged one entry at a time, the payload merges them per service
export function useStageNetworking(service: TServiceShallow) {
  const { teamId, projectId, environmentId } = useService();
  const stageList = useStagedChangesStore((s) => s.stageList);
  const discard = useStagedChangesStore((s) => s.discard);
  const icon = service.config.icon;

  const owner = useMemo(
    () => ({
      teamId,
      projectId,
      environmentId,
      serviceId: service.id,
      serviceName: service.name,
      serviceIcon: icon,
    }),
    [teamId, projectId, environmentId, service.id, service.name, icon],
  );
  const ports = service.config.ports;

  const stageHost = useCallback(
    (previous: THostTarget | null, value: THostTarget | null) =>
      stageList({
        ...owner,
        kind: "host",
        previous,
        value,
        addsPort: value?.port !== undefined && !ports.some((p) => p.port === value.port),
      }),
    [stageList, owner, ports],
  );

  const stagePort = useCallback(
    (port: number, op: "add" | "remove") => stageList({ ...owner, kind: "port", port, op }),
    [stageList, owner],
  );

  return { stageHost, stagePort, discard };
}

export function useStagedNetworking(service: TServiceShallow) {
  const discard = useStagedChangesStore((s) => s.discard);
  const lists = useStagedListChanges(service.id);
  const staged = useMemo(() => lists.filter((change) => change.kind !== "volume"), [lists]);

  const { hosts, ports } = service.config;
  const settledKey = listChangesMatchingServer(staged, {
    hosts: hosts.map((h) => ({ host: h.host, port: h.target_port })),
    ports: ports.map((p) => p.port),
  }).join(",");
  useEffect(() => {
    if (!settledKey) return;
    discard(settledKey.split(","));
  }, [settledKey, discard]);

  const unstage = useCallback(() => discard(staged.map((change) => change.id)), [discard, staged]);

  return { staged, unstage };
}

type TFormValues = Record<string, string | number | boolean>;

// Form defaults come from the staged values, so a discard elsewhere has to reset the
// form for the fields to show the server value again. Edits staged by this form
// already match the defaults and are left alone
export function useResetFormOnStagedChange<T extends TFormValues>(
  form: { reset: () => void; state: { values: T } },
  defaultValues: T,
  staged: TStagedFields,
  fields: TServiceChangeField[],
  onReset?: () => void,
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
    onReset?.();
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

export function stagedBoolean(change: TStagedServiceChange | undefined, fallback: boolean) {
  if (!change) return fallback;
  return change.value === true;
}
