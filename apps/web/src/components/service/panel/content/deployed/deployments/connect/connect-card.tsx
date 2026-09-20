import CopyButton from "@/components/copy-button";
import {
  connectionUrls,
  maskUrlPassword,
  PRIVATE_URL_KEY,
  TConnectionUrl,
} from "@/components/service/panel/content/deployed/deployments/connect/helpers";
import { useConnectOpen } from "@/components/service/panel/content/deployed/deployments/connect/use-connect-open";
import { useService } from "@/components/service/service-provider";
import { settingsIds } from "@/components/settings/settings-ids";
import { Button, LinkButton } from "@/components/ui/button";
import { providedVariablesKey } from "@/components/variables/constants";
import { readableToken } from "@/components/variables/tokens";
import { arrayHasAllSpecialDbVariables } from "@/components/variables/variables-list";
import { TServiceShallow } from "@/lib/queries/services";
import { TVariablesList, variablesListQuery } from "@/lib/queries/variables";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
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
  const { isOpen, setIsOpen } = useConnectOpen();
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
    <div className="flex w-full flex-col rounded-xl border">
      <Button
        data-open={isOpen || undefined}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        variant="ghost"
        className="group/button bg-card w-full justify-between gap-3 rounded-xl px-3.5 py-3 text-left font-semibold data-open:rounded-b-none data-open:border-b sm:px-4"
      >
        <span className="flex min-w-0 shrink items-center gap-2">
          <PlugIcon className="size-4.5 shrink-0" />
          <span className="min-w-0 shrink truncate leading-tight">Connect</span>
        </span>
        <ChevronDownIcon className="text-muted-more-foreground group-hover/button:text-muted-foreground group-active/button:text-muted-foreground -mr-0.5 size-5 shrink-0 transition-transform group-data-open/button:rotate-180" />
      </Button>
      {isOpen && (
        <div className="flex w-full flex-col gap-4 px-3.5 pt-3.5 sm:px-4">
          <Section
            title="From your services"
            description="Set a variable to this value in the service that needs the database."
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
                <ValueRow key={row.key} label={row.label} value={row.value}>
                  <ReferenceToken sourceName={service.name} referenceKey={row.key} />
                </ValueRow>
              ))}
          </Section>
          <Section
            title="From the internet"
            description={
              isPublic
                ? "For connecting from outside Unbind. The connection is not encrypted."
                : "This database is private. Make it public in Network Access to connect from outside Unbind."
            }
          >
            {isPublic && isPending && <ValueRow isPlaceholder />}
            {isPublic && isRedacted && (
              <NoteRow type="locked" text="Editor access is needed to see credentials" />
            )}
            {isPublic && !isPending && isWaitingForPublic && (
              <NoteRow
                type={error ? "error" : "waiting"}
                text={error ? error.message : "Public address will show up here"}
              />
            )}
            {isPublic &&
              !isRedacted &&
              urls.public.map((url) => (
                <ValueRow key={url.key} label={url.label} value={url.value} isSecret />
              ))}
          </Section>
          <div className="-mx-3.5 flex flex-wrap border-t px-2 py-1.5 sm:-mx-4 sm:px-2.5">
            <FooterLink
              teamId={teamId}
              projectId={projectId}
              search={{ service_tab: "variables", [providedVariablesKey]: true }}
            >
              Host, port and credentials
            </FooterLink>
            <FooterLink
              teamId={teamId}
              projectId={projectId}
              hash={settingsIds.networking.access}
              search={{ service_tab: "settings", highlight_id: settingsIds.networking.access }}
            >
              Network Access
            </FooterLink>
          </div>
        </div>
      )}
    </div>
  );
}

// A private URL is reached by reference, so the row shows the token to type instead
// of the value. When the URLs are not known (redacted) the primary key is still valid.
function referenceRows(serviceName: string, privateUrls: TConnectionUrl[]) {
  const keys = privateUrls.length > 0 ? privateUrls : [{ key: PRIVATE_URL_KEY, label: undefined }];
  return keys.map(({ key, label }) => ({ key, label, value: readableToken(serviceName, key) }));
}

// Same reading as the variable editor: the "${", the dot and the "}" are scaffolding
function ReferenceToken({
  sourceName,
  referenceKey,
}: {
  sourceName: string;
  referenceKey: string;
}) {
  return (
    <>
      <span className="text-muted-foreground">{"${"}</span>
      {sourceName}
      <span className="text-muted-foreground">.</span>
      {referenceKey}
      <span className="text-muted-foreground">{"}"}</span>
    </>
  );
}

function FooterLink({
  teamId,
  projectId,
  hash,
  search,
  children,
}: {
  teamId: string;
  projectId: string;
  hash?: string;
  search: Record<string, string | boolean>;
  children: ReactNode;
}) {
  return (
    <LinkButton
      to="/$team_id/project/$project_id"
      hash={hash}
      params={{ team_id: teamId, project_id: projectId }}
      search={(prev) => ({ ...prev, ...search })}
      variant="ghost"
      className="text-muted-foreground gap-0.5 rounded-md px-2 py-1.5 text-sm font-medium"
    >
      <span className="min-w-0 shrink">{children}</span>
      <ChevronRightIcon className="-mr-1 size-4 shrink-0" />
    </LinkButton>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-col gap-0.5 px-0.5">
        <h4 className="min-w-0 shrink leading-tight font-medium">{title}</h4>
        <p className="text-muted-foreground text-sm leading-snug">{description}</p>
      </div>
      {children}
    </div>
  );
}

type TValueRowProps =
  | { isPlaceholder: true; label?: never; value?: never; isSecret?: never; children?: never }
  | {
      isPlaceholder?: never;
      label?: string;
      value: string;
      isSecret?: boolean;
      // Replaces how the value is shown, what gets copied is still the value
      children?: ReactNode;
    };

function ValueRow({ label, value, isSecret, isPlaceholder, children }: TValueRowProps) {
  const [isVisible, setIsVisible] = useState(false);
  const shown = isPlaceholder
    ? "Loading connection"
    : isSecret && !isVisible
      ? maskUrlPassword(value)
      : (children ?? value);

  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className="group/card bg-input flex w-full items-start rounded-lg border p-0.5"
    >
      <p className="min-w-0 flex-1 px-2.5 py-1.75 font-mono text-xs leading-normal wrap-anywhere">
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
          className="text-muted-more-foreground group/button size-8 shrink-0 rounded-md"
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
        className="size-8 shrink-0 rounded-md"
        classNameIcon="size-4"
      />
    </div>
  );
}

function NoteRow({ type, text }: { type: "waiting" | "locked" | "error"; text: string }) {
  return (
    <div
      data-error={type === "error" || undefined}
      className="text-muted-foreground data-error:text-destructive flex w-full items-center gap-2 rounded-lg border px-3 py-2.25 text-sm"
    >
      {type === "waiting" && <HourglassIcon className="animate-hourglass size-4 shrink-0" />}
      {type === "locked" && <LockIcon className="size-4 shrink-0" />}
      <p className="min-w-0 shrink leading-tight">{text}</p>
    </div>
  );
}
