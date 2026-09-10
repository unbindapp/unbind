import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import type { TApplyingValues } from "@/components/staged-changes/reconcile";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import type { AffectedService, ChangeFailure } from "@/lib/server/client.gen";
import {
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  LoaderIcon,
  PenIcon,
  PlusIcon,
  SettingsIcon,
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
  isApplying: boolean;
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
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [showValues, setShowValues] = useState(false);
  const { isExtraSmall } = useDeviceSize();

  // Values hide again on every close, including one forced by the last change leaving the stage
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setShowValues(false);
  }

  const bodyProps = {
    showValues,
    onToggleValues: () => setShowValues((v) => !v),
    onDeployed: () => onOpenChange(false),
  };

  if (isExtraSmall) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerContent hasHandle className="max-h-[calc(100%-1.3rem)]">
          <DetailsBody
            {...bodyProps}
            variant="drawer"
            Title={DrawerTitle}
            Close={DrawerClose}
            className="pb-(--safe-area-inset-bottom)"
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideXButton
        className="max-h-[calc(var(--safe-screen-height)-var(--dialog-top-padding-sm)-var(--dialog-bottom-padding-sm))] gap-0 p-0"
        classNameInnerWrapper="w-216 max-w-full min-h-0 gap-0"
      >
        <DetailsBody {...bodyProps} variant="dialog" Title={DialogTitle} Close={DialogClose} />
      </DialogContent>
    </Dialog>
  );
}

type TDetailsBodyProps = {
  variant: "drawer" | "dialog";
  showValues: boolean;
  onToggleValues: () => void;
  onDeployed: () => void;
  className?: string;
  Title: FC<{ className?: string; children: ReactNode }>;
  Close: FC<{ className?: string; render: ReactElement }>;
};

function DetailsBody({
  variant,
  showValues,
  onToggleValues,
  onDeployed,
  className,
  Title,
  Close,
}: TDetailsBodyProps) {
  const variables = useStagedChangesStore((s) => s.variables);
  const services = useStagedChangesStore((s) => s.services);
  const applying = useStagedChangesStore((s) => s.applying);
  const discard = useStagedChangesStore((s) => s.discard);
  const { plan, deploy, lastResult, count } = useStagedChangesPlan();

  const groups = useMemo(
    () => groupChanges({ variables, services }, applying),
    [variables, services, applying],
  );
  const failures = lastResult?.failures ?? [];
  const isDrawer = variant === "drawer";

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col", className)}>
      {isDrawer ? (
        <div className="flex w-full flex-col items-center gap-3 border-b px-5 py-3.5">
          <div className="flex w-full items-center gap-6">
            <DetailsTitle Title={Title} count={count} />
            <div className="-my-2 -mr-3 ml-auto flex shrink-0 items-center gap-1">
              <ToggleValuesButton
                className="-ml-2.5 px-3.5 py-2 text-sm"
                classNameIcon="-ml-0.5 size-4"
                onToggleValues={onToggleValues}
                showValues={showValues}
              />
              <Close
                className="text-muted-more-foreground rounded-lg"
                render={
                  <Button type="button" size="icon" variant="ghost">
                    <XIcon className="size-5" />
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex w-full items-center gap-6 border-b px-5 py-3.5">
          <DetailsTitle Title={Title} count={count} className="pr-0" />
          <ToggleValuesButton
            onToggleValues={onToggleValues}
            className="-mr-3.5 ml-auto"
            showValues={showValues}
          />
        </div>
      )}
      <ScrollArea className="min-h-0 w-full flex-1 mask-[linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]">
        <div className="flex w-full flex-col gap-6 px-3 pt-4 pb-10 sm:px-5 sm:pb-8">
          {deploy.error && <ErrorLine message={deploy.error.message} withIcon />}
          {plan.error && <ErrorLine message={plan.error.message} withIcon />}
          <AffectedServices
            plan={plan.data?.affected ?? []}
            isRefetching={plan.isRefetching}
            isPending={plan.isPending}
          />
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
        </div>
      </ScrollArea>
      <div className="flex w-full items-center justify-end gap-2 border-t p-3.5">
        {!isDrawer && (
          <Close
            className="text-muted-foreground shrink-0 px-4.5"
            render={
              <Button type="button" variant="ghost">
                Close
              </Button>
            }
          />
        )}
        <Button
          variant="change"
          data-drawer={isDrawer || undefined}
          className="px-4.5 data-drawer:w-full"
          isPending={deploy.isPending}
          disabled={count === 0}
          onClick={() => deploy.mutate(undefined, { onSuccess: onDeployed })}
        >
          Deploy {count} {count === 1 ? "Change" : "Changes"}
        </Button>
      </div>
    </div>
  );
}

function ToggleValuesButton({
  showValues,
  onToggleValues,
  className,
  classNameIcon,
}: {
  showValues: boolean;
  onToggleValues: () => void;
  className?: string;
  classNameIcon?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("text-muted-foreground -my-2 min-w-0 shrink px-3.5", className)}
      onClick={onToggleValues}
    >
      {showValues ? (
        <EyeOffIcon className={cn("-ml-0.5 size-5 shrink-0", classNameIcon)} />
      ) : (
        <EyeIcon className={cn("-ml-0.5 size-5 shrink-0", classNameIcon)} />
      )}
      <span className="min-w-0 shrink truncate">{showValues ? "Hide" : "Show"}</span>
    </Button>
  );
}

function DetailsTitle({
  Title,
  count,
  className,
}: {
  count: number;
  Title: FC<{ className?: string; children: ReactNode }>;
  className?: string;
}) {
  return (
    <Title
      className={cn(
        "min-w-0 flex-1 truncate text-xl leading-tight font-semibold wrap-break-word",
        className,
      )}
    >
      {count} {count === 1 ? "Change" : "Changes"}
    </Title>
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
  const isApplying = group.rows.some((row) => row.isApplying);
  return (
    <li className="flex w-full flex-col overflow-hidden rounded-lg border">
      <div className="bg-card flex w-full items-center justify-between gap-2 border-b py-1 pr-1 pl-3">
        <div className="flex min-w-0 shrink items-center gap-2">
          <BrandIcon brand={group.icon} color="brand" className="size-5 shrink-0" />
          <p className="min-w-0 shrink truncate leading-tight font-semibold">{group.title}</p>
        </div>
        <div className="flex min-w-0 shrink items-center gap-4">
          <p className="text-muted-foreground min-w-0 shrink truncate text-sm leading-tight">
            {countsLabel(group.rows)}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-muted-foreground shrink-0 px-3"
            disabled={isApplying}
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
      <div className="flex w-full flex-col gap-3 px-2 py-3 sm:gap-3 sm:px-3">
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
        <ol className="flex w-full flex-col gap-4 sm:gap-2">
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
      <div className={cn("flex min-w-0 items-start gap-1.5", actionClassNames[action])}>
        <ActionIcon className="mt-px size-4 shrink-0" />
        <div className="flex min-w-0 shrink flex-col gap-0.5">
          <p
            className={cn(
              "min-w-0 shrink truncate text-sm leading-tight font-medium",
              row.isSecret && "font-mono",
            )}
          >
            {row.label}
          </p>
          <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs leading-tight">
            <KindIcon className="size-3 shrink-0" />
            <p>{kindLabels[row.kind]}</p>
          </div>
        </div>
      </div>
      {row.isApplying ? (
        <div className="text-muted-more-foreground flex h-10 w-8 shrink-0 items-center justify-center sm:order-last">
          <LoaderIcon className="size-4 animate-spin" />
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Discard"
          className="text-muted-more-foreground h-10 w-8 shrink-0 rounded-md sm:order-last"
          onClick={onDiscard}
        >
          <XIcon className="size-4" />
        </Button>
      )}
      <div className="col-span-2 grid grid-cols-2 gap-2">
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
      className="bg-foreground/1-10 data-[action=add]:bg-success/4-10 data-[action=edit]:bg-process/4-10 data-[action=remove]:bg-destructive/4-10 min-h-8 min-w-0 rounded-md px-2.5 py-2.25 font-mono text-sm leading-tight wrap-anywhere whitespace-pre-wrap"
    >
      {value || " "}
    </div>
  );
}

const actionLabels: Record<AffectedService["action"], string> = {
  build: "Rebuild",
  redeploy: "Redeploy",
  restart: "Restart",
  none: "No rollout",
};

function AffectedServices({
  plan,
  isRefetching,
  isPending,
}: {
  plan: AffectedService[];
  isRefetching: boolean;
  isPending: boolean;
}) {
  return (
    <div className="group/section flex w-full flex-col gap-2">
      <p className="min-w-0 shrink px-1 leading-tight font-semibold">
        <span className="pr-[0.75ch]">Affected Services</span>
        {!isPending && isRefetching && (
          <LoaderIcon className="text-muted-foreground inline-flex size-3.5 shrink-0 animate-spin" />
        )}
      </p>
      {!isPending && isRefetching === false && plan.length === 0 && (
        <p className="text-muted-foreground px-1 text-sm leading-tight">
          No running service is affected.
        </p>
      )}
      {plan.length > 0 && (
        <ul className="flex w-full flex-wrap gap-1.5">
          {plan.map((affected) => (
            <AffectedServiceChip key={affected.service_id} affected={affected} />
          ))}
        </ul>
      )}
      {isPending && (
        <ul className="flex w-full flex-wrap gap-1.5">
          <AffectedServiceChip isPlaceholder={true} />
        </ul>
      )}
    </div>
  );
}

type TAffectedServiceChipProps =
  { affected: AffectedService; isPlaceholder?: never } | { isPlaceholder: true; affected?: never };

function AffectedServiceChip({ affected, isPlaceholder }: TAffectedServiceChipProps) {
  return (
    <li
      data-placeholder={isPlaceholder || undefined}
      key={isPlaceholder ? "placeholder" : affected.service_id}
      className="group/chip flex min-w-0 items-center overflow-hidden rounded-md border text-sm font-medium"
    >
      <div className="flex min-w-0 items-center gap-1.5 border-r px-2.5 py-1.5">
        <BrandIcon
          brand={isPlaceholder ? "default" : affected.icon}
          color="brand"
          className="group-data-placeholder/chip:animate-skeleton group-data-placeholder/chip:bg-muted-foreground -ml-0.5 size-4 shrink-0 group-data-placeholder/chip:rounded-full group-data-placeholder/chip:text-transparent"
        />
        <span className="group-data-placeholder/chip:animate-skeleton group-data-placeholder/chip:bg-muted-foreground min-w-0 truncate leading-tight group-data-placeholder/chip:rounded group-data-placeholder/chip:text-transparent">
          {isPlaceholder ? "Service" : affected.name}
        </span>
      </div>
      <div className="bg-card flex min-w-0 shrink px-2.5 py-1.5">
        <span className="group-data-placeholder/chip:animate-skeleton group-data-placeholder/chip:bg-muted-more-foreground text-muted-foreground min-w-0 shrink leading-tight group-data-placeholder/chip:rounded group-data-placeholder/chip:text-transparent">
          {isPlaceholder ? "Redeploy" : actionLabels[affected.action]}
        </span>
      </div>
    </li>
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
function groupChanges(state: TStagedChangesState, applying: TApplyingValues): TChangeGroup[] {
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
      serviceRow(change, change.id in applying),
    );
  }
  for (const change of Object.values(state.variables)) {
    const key = change.scope.serviceId ?? variableScopeKey(change.scope);
    const icon = change.scope.serviceId ? (change.scopeIcon ?? "") : change.scope.type;
    upsert(
      key,
      change.scopeName,
      icon,
      change.scope.serviceId,
      variableRow(change, change.id in applying),
    );
  }

  const list = [...groups.values()];
  for (const group of list) group.rows.sort((a, b) => a.createdAt - b.createdAt);
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

function serviceRow(change: TStagedServiceChange, isApplying: boolean): TChangeRow {
  return {
    id: change.id,
    label: change.label,
    kind: "setting",
    previous: change.displayPrevious,
    value: change.displayValue,
    isSecret: false,
    isApplying,
    createdAt: change.createdAt,
  };
}

function variableRow(change: TStagedVariableChange, isApplying: boolean): TChangeRow {
  return {
    id: change.id,
    label: change.name,
    kind: "variable",
    previous: change.previous,
    value: change.value,
    isSecret: true,
    isApplying,
    createdAt: change.createdAt,
  };
}
