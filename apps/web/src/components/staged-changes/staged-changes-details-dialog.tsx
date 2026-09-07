import BrandIcon from "@/components/icons/brand";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import {
  useStagedChangesPlan,
  useStagedChangesStore,
} from "@/components/staged-changes/staged-changes-provider";
import {
  variableScopeKey,
  type TStagedChangesState,
  type TStagedServiceChange,
  type TStagedVariableChange,
} from "@/components/staged-changes/types";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import type { AffectedService, ChangeFailure } from "@/lib/server/client.gen";
import {
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  LoaderIcon,
  PlusIcon,
  SettingsIcon,
  PenIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { ComponentProps, FC, ReactElement, ReactNode, useMemo, useState } from "react";

const hiddenString = "••••••••••";

type TChangeKind = "variable" | "setting";
type TChangeAction = "add" | "remove" | "edit";

type TChangeRow = {
  id: string;
  label: string;
  kind: TChangeKind;
  previous: string | null;
  value: string | null;
  isSecret: boolean;
  createdAt: number;
};

type TChangeGroup = {
  key: string;
  title: string;
  icon: string;
  serviceId?: string;
  rows: TChangeRow[];
  createdAt: number;
};

export default function StagedChangesDetailsDialog({
  children,
  onOpenChange: onOpenChangeProp,
}: {
  children: ReactElement;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const { isExtraSmall } = useDeviceSize();

  const onOpenChange = (o: boolean) => {
    setOpen(o);
    onOpenChangeProp?.(o);
    if (!o) setShowValues(false);
  };

  const bodyProps = {
    showValues,
    onToggleValues: () => setShowValues((v) => !v),
    onDeployed: () => onOpenChange(false),
  };

  if (isExtraSmall) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerTrigger render={children} />
        <DrawerContent hasHandle className="max-h-[calc(100%-1.3rem)]">
          <DetailsBody
            {...bodyProps}
            Title={DrawerTitle}
            Description={DrawerDescription}
            Close={DrawerClose}
            className="pb-(--safe-area-inset-bottom)"
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent
        hideXButton
        className="max-h-[calc(var(--safe-screen-height)-var(--dialog-top-padding-sm)-var(--dialog-bottom-padding-sm))] gap-0 p-0"
        classNameInnerWrapper="w-192 max-w-full min-h-0 gap-0"
      >
        <DetailsBody
          {...bodyProps}
          Title={DialogTitle}
          Description={DialogDescription}
          Close={DialogClose}
        />
      </DialogContent>
    </Dialog>
  );
}

type TDetailsBodyProps = {
  showValues: boolean;
  onToggleValues: () => void;
  onDeployed: () => void;
  className?: string;
  Title: FC<{ className?: string; children: ReactNode }>;
  Description: FC<{ className?: string; children: ReactNode }>;
  Close: FC<{ className?: string; render: ReactElement }>;
};

function DetailsBody({
  showValues,
  onToggleValues,
  onDeployed,
  className,
  Title,
  Description,
  Close,
}: TDetailsBodyProps) {
  const variables = useStagedChangesStore((s) => s.variables);
  const services = useStagedChangesStore((s) => s.services);
  const discard = useStagedChangesStore((s) => s.discard);
  const { plan, deploy, lastResult, count } = useStagedChangesPlan();

  const groups = useMemo(() => groupChanges({ variables, services }), [variables, services]);
  const failures = lastResult?.failures ?? [];

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col", className)}>
      <div className="flex w-full flex-col gap-1.5 border-b px-4 pt-3.5 pb-3 sm:px-5">
        <div className="flex w-full items-start justify-between gap-3">
          <Title className="min-w-0 shrink pr-0 text-xl leading-tight font-semibold">
            {count} {count === 1 ? "Change" : "Changes"}
          </Title>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground -my-1 -mr-2.5 max-w-1/2 min-w-0 shrink px-2.5"
            onClick={onToggleValues}
          >
            {showValues ? (
              <EyeOffIcon className="-ml-px size-4 shrink-0" />
            ) : (
              <EyeIcon className="-ml-px size-4 shrink-0" />
            )}
            <span className="min-w-0 shrink truncate">{showValues ? "Hide" : "Show"}</span>
          </Button>
        </div>
        <Description className="text-muted-foreground text-left text-sm">
          Staged changes are deployed together.
        </Description>
      </div>
      <ScrollArea className="min-h-0 w-full flex-1">
        <div className="flex w-full flex-col gap-4 px-4 py-4 sm:px-5">
          {deploy.error && <ErrorLine message={deploy.error.message} withIcon />}
          {plan.error && <ErrorLine message={plan.error.message} withIcon />}
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
      <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-5">
        <Close
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
          onClick={() => deploy.mutate(undefined, { onSuccess: onDeployed })}
        >
          Deploy
        </Button>
      </div>
    </div>
  );
}

const rowGrid =
  "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-x-3";

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
          <BrandIcon brand={group.icon} color="brand" className="size-5 shrink-0" />
          <p className="min-w-0 shrink truncate leading-tight font-semibold">{group.title}</p>
        </div>
        <div className="flex min-w-0 shrink items-center gap-2">
          <p className="text-muted-foreground min-w-0 shrink truncate text-sm leading-tight">
            {countsLabel(group.rows)}
          </p>
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
      </div>
      {failure && (
        <div className="w-full p-2 pb-0">
          <ErrorLine message={failure.message} withIcon />
        </div>
      )}
      <div className="flex w-full flex-col gap-3 p-2 sm:gap-2">
        <div
          className={cn(
            rowGrid,
            "text-muted-foreground hidden px-1 text-xs leading-tight font-medium sm:grid",
          )}
        >
          <p>Change</p>
          <p>Current Value</p>
          <p>New Value</p>
          <div className="w-7" />
        </div>
        <ol className="flex w-full flex-col gap-3 sm:gap-1.5">
          {group.rows.map((row) => (
            <ChangeRow
              key={row.id}
              row={row}
              showValues={showValues}
              onDiscard={() => onDiscardRow(row.id)}
            />
          ))}
        </ol>
      </div>
    </li>
  );
}

const actionClassNames: Record<TChangeAction, string> = {
  add: "text-success",
  remove: "text-destructive",
  edit: "text-process",
};

const actionIcons: Record<TChangeAction, FC<ComponentProps<"svg">>> = {
  add: PlusIcon,
  remove: Trash2Icon,
  edit: PenIcon,
};

const kindIcons: Record<TChangeKind, FC<ComponentProps<"svg">>> = {
  variable: KeyIcon,
  setting: SettingsIcon,
};

const kindLabels: Record<TChangeKind, string> = {
  variable: "Variable",
  setting: "Setting",
};

function ChangeRow({
  row,
  showValues,
  onDiscard,
}: {
  row: TChangeRow;
  showValues: boolean;
  onDiscard: () => void;
}) {
  const action = rowAction(row);
  const ActionIcon = actionIcons[action];
  const KindIcon = kindIcons[row.kind];
  const mask = (value: string) => (row.isSecret && !showValues ? hiddenString : value);

  return (
    <li className={cn(rowGrid, "items-start px-1")}>
      <div className={cn("flex min-w-0 items-center gap-1.5 py-1.5", actionClassNames[action])}>
        <ActionIcon className="size-4 shrink-0" />
        <KindIcon className="size-4 shrink-0" />
        <p
          className={cn(
            "min-w-0 shrink truncate text-sm leading-tight font-medium",
            row.isSecret && "font-mono",
          )}
        >
          {row.label}
        </p>
        <p className="text-muted-foreground shrink-0 text-xs leading-tight">
          {kindLabels[row.kind]}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Discard"
        className="text-muted-more-foreground size-7 shrink-0 rounded-md sm:order-last"
        onClick={onDiscard}
      >
        <XIcon className="size-4" />
      </Button>
      <div className="col-span-2 grid grid-cols-2 gap-2 sm:contents">
        <ValueCell action={action} value={row.previous === null ? null : mask(row.previous)} />
        <ValueCell action={action} value={row.value === null ? null : mask(row.value)} isNew />
      </div>
    </li>
  );
}

function ValueCell({
  action,
  value,
  isNew,
}: {
  action: TChangeAction;
  value: string | null;
  isNew?: boolean;
}) {
  return (
    <div
      data-action={isNew ? action : undefined}
      className="bg-foreground/4 data-[action=add]:bg-success/10 data-[action=edit]:bg-process/10 data-[action=remove]:bg-destructive/10 min-h-8 min-w-0 rounded-md px-2.5 py-1.5 font-mono text-sm leading-tight wrap-anywhere whitespace-pre-wrap"
    >
      {value}
    </div>
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
              className="bg-foreground/6 text-muted-foreground data-[action=build]:bg-change/12 data-[action=build]:text-change data-[action=redeploy]:bg-change/12 data-[action=redeploy]:text-change data-[action=restart]:bg-wait/12 data-[action=restart]:text-wait flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium"
            >
              <BrandIcon brand={affected.icon} color="brand" className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{affected.name}</span>
              <span className="shrink-0 opacity-70">{actionLabels[affected.action]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function rowAction(row: TChangeRow): TChangeAction {
  if (row.previous === null) return "add";
  if (row.value === null) return "remove";
  return "edit";
}

function countsLabel(rows: TChangeRow[]) {
  const variables = rows.filter((r) => r.kind === "variable").length;
  const settings = rows.length - variables;
  const parts: string[] = [];
  if (variables > 0) parts.push(`${variables} ${variables === 1 ? "Variable" : "Variables"}`);
  if (settings > 0) parts.push(`${settings} ${settings === 1 ? "Setting" : "Settings"}`);
  return parts.join(" · ");
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
function groupChanges(state: TStagedChangesState): TChangeGroup[] {
  const groups = new Map<string, TChangeGroup>();
  const upsert = (
    key: string,
    title: string,
    icon: string,
    serviceId: string | undefined,
    row: TChangeRow,
  ) => {
    let group = groups.get(key);
    if (!group) {
      group = { key, title, icon, serviceId, rows: [], createdAt: row.createdAt };
      groups.set(key, group);
    }
    group.rows.push(row);
    group.createdAt = Math.min(group.createdAt, row.createdAt);
  };

  for (const change of Object.values(state.services)) {
    upsert(
      change.serviceId,
      change.serviceName,
      change.serviceIcon ?? "",
      change.serviceId,
      serviceRow(change),
    );
  }
  for (const change of Object.values(state.variables)) {
    const key = change.scope.serviceId ?? variableScopeKey(change.scope);
    const icon = change.scope.serviceId ? (change.scopeIcon ?? "") : change.scope.type;
    upsert(key, change.scopeName, icon, change.scope.serviceId, variableRow(change));
  }

  const list = [...groups.values()];
  for (const group of list) group.rows.sort((a, b) => a.createdAt - b.createdAt);
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

function serviceRow(change: TStagedServiceChange): TChangeRow {
  return {
    id: change.id,
    label: change.label,
    kind: "setting",
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
    kind: "variable",
    previous: change.previous,
    value: change.value,
    isSecret: true,
    createdAt: change.createdAt,
  };
}
