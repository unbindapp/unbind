import CopyButton from "@/components/copy-button";
import { NetworkAccessIcon, networkAccessLabel } from "@/components/service/network-access";
import {
  connectionUrls,
  maskUrlPassword,
  PRIVATE_URL_KEY,
  TConnectionUrl,
} from "@/components/service/panel/content/deployed/deployments/connect/helpers";
import { useService } from "@/components/service/service-provider";
import { settingsIds } from "@/components/settings/settings-ids";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { providedVariablesKey } from "@/components/variables/constants";
import { readableToken } from "@/components/variables/tokens";
import { arrayHasAllSpecialDbVariables } from "@/components/variables/variables-list";
import { TServiceShallow } from "@/lib/queries/services";
import { TVariablesList, variablesListQuery } from "@/lib/queries/variables";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  HourglassIcon,
  LockIcon,
  PlugIcon,
} from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

const refetchIntervalMs = 3000;

type TProps = {
  service: TServiceShallow;
};

export default function ConnectCard({ service }: TProps) {
  const { teamId, projectId, environmentId, serviceId } = useService();
  const isPublic = service.config.is_public;

  // The credentials show up a while after the first deploy and the public address
  // after the change that made the database public, so keep asking until both are in
  const isComplete = (data: TVariablesList | undefined) => {
    if (!data) return false;
    if (data.values_redacted) return true;
    const names = data.variables.map((v) => v.name);
    if (!arrayHasAllSpecialDbVariables(names, service.database_type || "")) return false;
    const urls = connectionUrls(data.variables);
    if (urls.private.length === 0) return false;
    return !isPublic || urls.public.length > 0;
  };

  const { data, error, isPending } = useQuery({
    ...variablesListQuery({ teamId, projectId, environmentId, serviceId, type: "service" }),
    refetchInterval: (query) => (isComplete(query.state.data) ? false : refetchIntervalMs),
  });

  const urls = useMemo(() => connectionUrls(data?.variables ?? []), [data]);
  const isRedacted = data?.values_redacted === true;
  const isWaitingForPrivate = !isRedacted && urls.private.length === 0;
  const isWaitingForPublic = !isRedacted && urls.public.length === 0;

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border px-3.5 pt-2.5 pb-3.5 sm:px-4">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 shrink items-center gap-2">
          <PlugIcon className="size-4.5 shrink-0" />
          <h3 className="min-w-0 shrink truncate leading-tight font-semibold">Connect</h3>
        </div>
        <SettingsLink
          teamId={teamId}
          projectId={projectId}
          className="text-muted-foreground -mr-2 gap-1.5"
        >
          <NetworkAccessIcon isPublic={isPublic} className="size-3.5 shrink-0" />
          <span className="min-w-0 shrink truncate">{networkAccessLabel(isPublic)}</span>
        </SettingsLink>
      </div>
      <Section
        title="From your services"
        badge="Recommended"
        description="Set this as the value of a variable on another service. It stays in sync when the password changes."
      >
        {isPending && <ValueRow isPlaceholder />}
        {!isPending && isWaitingForPrivate && (
          <NoteRow
            type={error ? "error" : "waiting"}
            text={error ? error.message : "Available once the database is ready"}
          />
        )}
        {!isPending &&
          !isWaitingForPrivate &&
          referenceRows(service.name, urls.private).map((row) => (
            <ValueRow key={row.key} label={row.label} value={row.value} />
          ))}
      </Section>
      {isPublic && (
        <Section
          title="From the internet"
          description="This connection is not encrypted. Use it for tools on your machine, and the one above for services on Unbind."
        >
          {isPending && <ValueRow isPlaceholder />}
          {isRedacted && (
            <NoteRow type="locked" text="Editor access is needed to see credentials" />
          )}
          {!isPending && isWaitingForPublic && (
            <NoteRow
              type={error ? "error" : "waiting"}
              text={error ? error.message : "Public address will show up here"}
            />
          )}
          {!isRedacted &&
            urls.public.map((url) => (
              <ValueRow key={url.key} label={url.label} value={url.value} isSecret />
            ))}
        </Section>
      )}
      {!isPublic && (
        <p className="text-muted-foreground -mt-1 px-0.5 text-sm leading-snug">
          Private, only your services can reach it.{" "}
          <SettingsLink
            teamId={teamId}
            projectId={projectId}
            className="text-foreground -mx-1 -my-0.5 inline-flex px-1 py-0.5"
          >
            Make it public
          </SettingsLink>
        </p>
      )}
      <LinkButton
        to="/$team_id/project/$project_id"
        params={{ team_id: teamId, project_id: projectId }}
        search={(prev) => ({ ...prev, service_tab: "variables", [providedVariablesKey]: true })}
        variant="ghost"
        className="text-muted-foreground -mx-1.5 -my-1.5 gap-0.5 self-start rounded-md px-2 py-1.5 text-sm font-medium"
      >
        <span className="min-w-0 shrink">Host, port and credentials are in Variables</span>
        <ChevronRightIcon className="-mr-1 size-4 shrink-0" />
      </LinkButton>
    </div>
  );
}

// A private URL is reached by reference, so the row shows the token to type instead
// of the value. When the URLs are not known (redacted) the primary key is still valid.
function referenceRows(serviceName: string, privateUrls: TConnectionUrl[]) {
  const keys = privateUrls.length > 0 ? privateUrls : [{ key: PRIVATE_URL_KEY, label: undefined }];
  return keys.map(({ key, label }) => ({ key, label, value: readableToken(serviceName, key) }));
}

function SettingsLink({
  teamId,
  projectId,
  className,
  children,
}: {
  teamId: string;
  projectId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <LinkButton
      to="/$team_id/project/$project_id"
      hash={settingsIds.networking.access}
      params={{ team_id: teamId, project_id: projectId }}
      search={(prev) => ({
        ...prev,
        service_tab: "settings",
        highlight_id: settingsIds.networking.access,
      })}
      variant="ghost"
      className={cn("rounded-md px-2 py-1.5 text-sm font-medium", className)}
    >
      {children}
    </LinkButton>
  );
}

function Section({
  title,
  badge,
  description,
  children,
}: {
  title: string;
  badge?: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="flex w-full items-center gap-2 px-0.5">
        <h4 className="min-w-0 shrink text-sm leading-tight font-medium">{title}</h4>
        {badge && (
          <span className="bg-success/1-10 text-success border-success/3-10 shrink-0 rounded-full border px-1.5 py-px text-xs leading-tight font-medium">
            {badge}
          </span>
        )}
      </div>
      {children}
      <p className="text-muted-foreground px-0.5 text-sm leading-snug">{description}</p>
    </div>
  );
}

type TValueRowProps =
  | { isPlaceholder: true; label?: never; value?: never; isSecret?: never }
  | { isPlaceholder?: never; label?: string; value: string; isSecret?: boolean };

function ValueRow({ label, value, isSecret, isPlaceholder }: TValueRowProps) {
  const [isVisible, setIsVisible] = useState(false);
  const shown = isPlaceholder
    ? "Loading connection"
    : isSecret && !isVisible
      ? maskUrlPassword(value)
      : value;

  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className="group/card bg-input flex w-full items-start rounded-lg border p-0.5"
    >
      <p className="min-w-0 flex-1 px-2.5 py-2 font-mono text-xs leading-normal wrap-anywhere">
        {label && <span className="text-muted-foreground mr-2 font-sans font-medium">{label}</span>}
        <span className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
          {shown}
        </span>
      </p>
      {isSecret && (
        <Button
          type="button"
          aria-label={isVisible ? "Hide password" : "Show password"}
          data-visible={isVisible || undefined}
          onClick={() => setIsVisible((prev) => !prev)}
          variant="ghost"
          forceMinSize="medium"
          size="icon"
          className="text-muted-more-foreground group/button size-8 rounded-md"
        >
          <div className="relative size-4">
            <EyeIcon className="size-full group-data-visible/button:opacity-0" />
            <EyeOffIcon className="absolute top-0 left-0 size-full opacity-0 group-data-visible/button:opacity-100" />
          </div>
        </Button>
      )}
      <CopyButton
        valueToCopy={value}
        isPlaceholder={isPlaceholder}
        className="size-8 rounded-md"
        classNameIcon="size-4"
      />
    </div>
  );
}

function NoteRow({ type, text }: { type: "waiting" | "locked" | "error"; text: string }) {
  return (
    <div
      data-error={type === "error" || undefined}
      className="text-muted-foreground data-error:text-destructive flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
    >
      {type === "waiting" && <HourglassIcon className="animate-hourglass size-4 shrink-0" />}
      {type === "locked" && <LockIcon className="size-4 shrink-0" />}
      <p className="min-w-0 shrink leading-tight">{text}</p>
    </div>
  );
}
