import { useChangesPlan, useChangesStore } from "@/components/changes/changes-provider";
import {
  variableScopeKey,
  type TChangesState,
  type TStagedServiceChange,
  type TStagedVariableChange,
} from "@/components/changes/types";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import type { AffectedService, ChangeFailure } from "@/lib/server/client.gen";
import {
  ArrowRightIcon,
  BoxIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  LoaderIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { ReactElement, useMemo, useState } from "react";

const hiddenString = "••••••••••";

type TChangeRow = {
  id: string;
  label: string;
  previous: string | null;
  value: string | null;
  isSecret: boolean;
  createdAt: number;
};

type TChangeGroup = {
  key: string;
  title: string;
  serviceId?: string;
  isVariablesOnly: boolean;
  rows: TChangeRow[];
  createdAt: number;
};

export default function ChangesDetailsDialog({ children }: { children: ReactElement }) {
  const [open, setOpen] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const variables = useChangesStore((s) => s.variables);
  const services = useChangesStore((s) => s.services);
  const discard = useChangesStore((s) => s.discard);
  const { plan, deploy, lastResult, count } = useChangesPlan();

  const groups = useMemo(() => groupChanges({ variables, services }), [variables, services]);
  const failures = lastResult?.failures ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setShowValues(false);
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent
        hideXButton
        className="max-h-[calc(var(--safe-screen-height)-var(--dialog-top-padding)-var(--dialog-bottom-padding))] sm:max-h-[calc(var(--safe-screen-height)-var(--dialog-top-padding-sm)-var(--dialog-bottom-padding-sm))]"
        classNameInnerWrapper="w-144 max-w-full min-h-0"
      >
        <DialogHeader>
          <div className="flex w-full items-start justify-between gap-3">
            <DialogTitle>
              {count} {count === 1 ? "Change" : "Changes"}
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -my-1 -mr-2.5 max-w-1/2 min-w-0 shrink px-2.5"
              onClick={() => setShowValues((v) => !v)}
            >
              {showValues ? (
                <EyeOffIcon className="-ml-px size-4 shrink-0" />
              ) : (
                <EyeIcon className="-ml-px size-4 shrink-0" />
              )}
              <span className="min-w-0 shrink truncate">{showValues ? "Hide" : "Show"} </span>
            </Button>
          </div>
          <DialogDescription>
            Staged changes are deployed together. Each affected service rolls out once.
          </DialogDescription>
        </DialogHeader>
        {deploy.error && <ErrorLine message={deploy.error.message} withIcon />}
        {plan.error && <ErrorLine message={plan.error.message} withIcon />}
        <ScrollArea className="-mx-2 min-h-0 w-[calc(100%+1rem)] flex-1 px-2">
          <div className="flex w-full flex-col gap-4">
            <ol className="flex w-full flex-col gap-3">
              {groups.map((group) => (
                <ChangeGroupCard
                  key={group.key}
                  group={group}
                  showValues={showValues}
                  failure={failureForGroup(group, failures)}
                  onDiscardRow={(id) => discard([id])}
                  onDiscardGroup={() => discard(group.rows.map((r) => r.id))}
                />
              ))}
            </ol>
            <AffectedServices plan={plan.data?.affected ?? []} isFetching={plan.isFetching} />
          </div>
        </ScrollArea>
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose
            className="text-muted-foreground"
            render={
              <Button type="button" variant="ghost">
                Close
              </Button>
            }
          />
          <Button
            variant="change"
            isPending={deploy.isPending}
            disabled={count === 0}
            onClick={() => deploy.mutate(undefined, { onSuccess: () => setOpen(false) })}
          >
            Deploy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChangeGroupCard({
  group,
  showValues,
  failure,
  onDiscardRow,
  onDiscardGroup,
}: {
  group: TChangeGroup;
  showValues: boolean;
  failure?: ChangeFailure;
  onDiscardRow: (id: string) => void;
  onDiscardGroup: () => void;
}) {
  return (
    <li className="flex w-full flex-col overflow-hidden rounded-lg border">
      <div className="bg-card flex w-full items-center justify-between gap-2 border-b py-1 pr-1 pl-3">
        <div className="flex min-w-0 shrink items-center gap-2">
          {group.isVariablesOnly && !group.serviceId ? (
            <KeyIcon className="text-muted-foreground size-4 shrink-0" />
          ) : (
            <BoxIcon className="text-muted-foreground size-4 shrink-0" />
          )}
          <p className="min-w-0 shrink truncate leading-tight font-semibold">{group.title}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground shrink-0"
          onClick={onDiscardGroup}
        >
          Discard
        </Button>
      </div>
      {failure && (
        <div className="w-full p-1.5 pb-0">
          <ErrorLine message={failure.message} withIcon />
        </div>
      )}
      <ol className="flex w-full flex-col p-1.5">
        {group.rows.map((row) => (
          <ChangeRow
            key={row.id}
            row={row}
            showValues={showValues}
            onDiscard={() => onDiscardRow(row.id)}
          />
        ))}
      </ol>
    </li>
  );
}

function ChangeRow({
  row,
  showValues,
  onDiscard,
}: {
  row: TChangeRow;
  showValues: boolean;
  onDiscard: () => void;
}) {
  const mask = (value: string) => (row.isSecret && !showValues ? hiddenString : value);

  return (
    <li className="flex w-full items-start gap-2 rounded-md px-1.5 py-1">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p
          className={cn(
            "min-w-0 truncate text-sm leading-tight font-medium",
            row.isSecret && "font-mono",
          )}
        >
          {row.label}
        </p>
        <div className="text-muted-foreground flex min-w-0 items-center gap-1.5 font-mono text-xs leading-normal wrap-anywhere">
          {row.previous === null ? (
            <span className="text-change font-semibold">New</span>
          ) : (
            <span className="min-w-0">{mask(row.previous)}</span>
          )}
          <ArrowRightIcon className="size-3 shrink-0" />
          {row.value === null ? (
            <span className="text-change font-semibold">Removed</span>
          ) : (
            <span className="text-foreground min-w-0 whitespace-pre-wrap">{mask(row.value)}</span>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Discard"
        className="text-muted-more-foreground -my-1 -mr-1 size-7 shrink-0 rounded-md"
        onClick={onDiscard}
      >
        <XIcon className="size-4" />
      </Button>
    </li>
  );
}

const actionLabels: Record<AffectedService["action"], string> = {
  build: "Rebuild",
  redeploy: "Redeploy",
  restart: "Restart",
  none: "No rollout",
};

function AffectedServices({ plan, isFetching }: { plan: AffectedService[]; isFetching: boolean }) {
  return (
    <div className="flex w-full flex-col gap-1.5 px-1">
      <div className="flex w-full items-center gap-2">
        <p className="text-muted-foreground text-sm leading-tight font-semibold">
          Services That Will Roll Out
        </p>
        {isFetching && <LoaderIcon className="text-muted-foreground size-3.5 animate-spin" />}
      </div>
      {plan.length === 0 && !isFetching && (
        <p className="text-muted-foreground text-sm leading-tight">
          No running service is affected.
        </p>
      )}
      {plan.length > 0 && (
        <ul className="flex w-full flex-wrap gap-1.5">
          {plan.map((affected) => (
            <li
              key={affected.service_id}
              data-action={affected.action}
              className="bg-foreground/6 text-muted-foreground data-[action=build]:bg-change/12 data-[action=build]:text-change data-[action=redeploy]:bg-change/12 data-[action=redeploy]:text-change data-[action=restart]:bg-wait/12 data-[action=restart]:text-wait flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium"
            >
              <SettingsIcon className="size-3.5" />
              <span className="min-w-0 truncate">{affected.name}</span>
              <span className="opacity-70">{actionLabels[affected.action]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function failureForGroup(group: TChangeGroup, failures: ChangeFailure[]) {
  return failures.find((failure) => {
    if (failure.service_id && failure.service_id === group.serviceId) return true;
    if (!failure.variables) return false;
    return (
      variableScopeKey({
        type: failure.variables.type,
        teamId: failure.variables.team_id,
        projectId: failure.variables.project_id,
        environmentId: failure.variables.environment_id,
        serviceId: failure.variables.service_id,
      }) === group.key
    );
  });
}

// Changes of a service and of its own variables share a group, other scopes get their own
function groupChanges(state: TChangesState): TChangeGroup[] {
  const groups = new Map<string, TChangeGroup>();
  const upsert = (key: string, title: string, serviceId: string | undefined, row: TChangeRow) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, title, serviceId, isVariablesOnly: true, rows: [], createdAt: row.createdAt };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.createdAt = Math.min(group.createdAt, row.createdAt);
    return group;
  };

  for (const change of Object.values(state.services)) {
    const group = upsert(
      change.serviceId,
      change.serviceName,
      change.serviceId,
      serviceRow(change),
    );
    group.isVariablesOnly = false;
  }
  for (const change of Object.values(state.variables)) {
    const key = change.scope.serviceId ?? variableScopeKey(change.scope);
    upsert(key, change.scopeName, change.scope.serviceId, variableRow(change));
  }

  const list = [...groups.values()];
  for (const group of list) group.rows.sort((a, b) => a.createdAt - b.createdAt);
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

function serviceRow(change: TStagedServiceChange): TChangeRow {
  return {
    id: change.id,
    label: change.label,
    previous: change.displayPrevious,
    value: change.displayValue,
    isSecret: false,
    createdAt: change.createdAt,
  };
}

function variableRow(change: TStagedVariableChange): TChangeRow {
  return {
    id: change.id,
    label: change.name,
    previous: change.previous,
    value: change.value,
    isSecret: true,
    createdAt: change.createdAt,
  };
}
