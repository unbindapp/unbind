import CopyButton from "@/components/copy-button";
import AddToService from "@/components/service/panel/content/deployed/deployments/connect/add-to-service";
import {
  connectionUrls,
  hasMultipleUrls,
  maskUrlPassword,
  PRIVATE_URL_KEY,
  TConnectionUrl,
} from "@/components/service/panel/content/deployed/deployments/connect/helpers";
import { useConnectOpen } from "@/components/service/panel/content/deployed/deployments/connect/use-connect-open";
import { useService } from "@/components/service/service-provider";
import { Button, LinkButton } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { providedVariablesKey, variablesSectionId } from "@/components/variables/constants";
import { readableToken } from "@/components/variables/tokens";
import { arrayHasAllSpecialDbVariables } from "@/components/variables/variables-list";
import { TServiceShallow } from "@/lib/queries/services";
import { TVariablesList, variablesListQuery } from "@/lib/queries/variables";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BoxIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GlobeIcon,
  HourglassIcon,
  LockIcon,
  LucideIcon,
  TriangleAlertIcon,
  UnplugIcon,
} from "lucide-react";
import { FC, ReactNode, useMemo, useState } from "react";

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
    <div className="flex w-full flex-col overflow-hidden rounded-xl border">
      <Button
        data-open={isOpen || undefined}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        variant="ghost"
        className="group/button bg-card w-full justify-between gap-3 px-3.5 py-3 text-left font-semibold data-open:rounded-b-none data-open:border-b"
      >
        <div className="flex min-w-0 shrink items-start gap-2">
          <UnplugIcon className="mt-px size-4.5 shrink-0" />
          <div className="text-muted-foreground flex min-w-0 shrink flex-col items-start gap-0.5 text-sm leading-tight wrap-break-word sm:flex-row sm:gap-4">
            <p className="text-foreground text-base leading-tight">Connect</p>
            {!isOpen ? (
              <p className="text-muted-foreground max-w-full min-w-0 shrink text-sm font-normal wrap-break-word">
                Instructions on how to connect to the database
              </p>
            ) : null}
          </div>
        </div>
        <ChevronDownIcon className="text-muted-more-foreground group-hover/button:text-muted-foreground group-active/button:text-muted-foreground -mr-0.5 size-5 shrink-0 transition-transform group-data-open/button:rotate-180" />
      </Button>
      {isOpen && (
        <div className="flex w-full flex-col gap-5 px-3.5 pt-3.5 sm:px-4">
          <Section
            title="From your services"
            description={
              hasMultipleUrls(service.database_type || "")
                ? "Add one of these as a variable on any service that will connect to the database."
                : "Add this as a variable on any service that will connect to the database."
            }
            Icon={BoxIcon}
          >
            {isPending && (
              <PrivateRow>
                <ConnectRow isPlaceholder className="lg:min-w-0 lg:flex-1" />
                <AddToService isPlaceholder className="lg:max-w-xs lg:flex-1" />
              </PrivateRow>
            )}
            {!isPending && isWaitingForPrivate && (
              <PrivateRow>
                <ConnectRow
                  Icon={error ? TriangleAlertIcon : WaitingIcon}
                  isError={!!error}
                  className="lg:min-w-0 lg:flex-1"
                >
                  {error ? error.message : "The variable will be shown once the database is ready"}
                </ConnectRow>
                {/* An error means nothing is on its way, so there is nothing to reserve room for */}
                {!error && <AddToService isDisabled className="lg:max-w-xs lg:flex-1" />}
              </PrivateRow>
            )}

            {!isPending &&
              !isWaitingForPrivate &&
              referenceRows(service.name, urls.private).map((row) => (
                <PrivateRow key={row.key}>
                  <ConnectRow label={row.label} value={row.value} className="lg:min-w-0 lg:flex-1">
                    <ReferenceToken sourceName={service.name} referenceKey={row.key} />
                  </ConnectRow>
                  <AddToService
                    databaseType={service.database_type || ""}
                    label={row.label}
                    value={row.value}
                    className="lg:max-w-xs lg:flex-1"
                  />
                </PrivateRow>
              ))}
          </Section>
          <Section
            title="From the internet"
            description={
              isPublic ? (
                "For connecting from outside Unbind."
              ) : (
                <>
                  This database is private. Make it public in{" "}
                  <Link
                    to="/$team_id/project/$project_id"
                    params={{ team_id: teamId, project_id: projectId }}
                    search={(prev) => ({
                      ...prev,
                      service_tab: "settings",
                    })}
                    hash="networking_access"
                    className="text-foreground active:bg-process/3-10 ring-process/5-10 has-hover:hover:text-process active:text-process has-hover:hover:bg-process/3-10 -mx-0.5 rounded-sm px-0.5 font-medium active:ring-1 has-hover:hover:ring-1"
                  >
                    Network Access
                  </Link>{" "}
                  to connect from outside Unbind.
                </>
              )
            }
            Icon={GlobeIcon}
          >
            {isPublic && isPending && <ConnectRow isPlaceholder isSecret />}
            {isPublic && isRedacted && (
              <ConnectRow Icon={LockIcon}>Editor access is needed to see credentials</ConnectRow>
            )}
            {isPublic && !isPending && isWaitingForPublic && (
              <ConnectRow Icon={error ? TriangleAlertIcon : WaitingIcon} isError={!!error}>
                {error
                  ? error.message
                  : "The public address will be shown once the database is ready"}
              </ConnectRow>
            )}
            {isPublic &&
              !isRedacted &&
              urls.public.map((url) => (
                <ConnectRow key={url.key} label={url.label} value={url.value} isSecret />
              ))}
          </Section>
          <div className="-mx-3.5 flex flex-wrap border-t px-1.5 py-1.5 sm:-mx-4">
            <FooterLink
              teamId={teamId}
              projectId={projectId}
              hash={variablesSectionId}
              search={{ service_tab: "variables", [providedVariablesKey]: true }}
            >
              Credentials, host, and port
            </FooterLink>
          </div>
        </div>
      )}
    </div>
  );
}

// The URL and the service it can be added to, side by side once there is room
function PrivateRow({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-1.5 lg:flex-row">{children}</div>;
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
      <span className="text-muted-more-foreground">{"${"}</span>
      {sourceName}
      <span className="text-muted-more-foreground">.</span>
      {referenceKey}
      <span className="text-muted-more-foreground">{"}"}</span>
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
  Icon,
  children,
}: {
  title: string;
  description: string | ReactNode;
  Icon: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-col gap-1.5 px-1">
        <div className="flex w-full items-start gap-1.5">
          <Icon className="mt-0.5 size-4 shrink-0" />
          <h4 className="min-w-0 shrink leading-tight font-medium wrap-break-word">{title}</h4>
        </div>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </div>
  );
}

type TConnectRowProps = {
  // A row with a value gets the buttons, a row without one is a note
  value?: string;
  label?: string;
  className?: string;
  Icon?: FC<{ className?: string }>;
  isSecret?: boolean;
  isPlaceholder?: boolean;
  isError?: boolean;
  // Replaces how the value is shown, what gets copied is still the value
  children?: ReactNode;
};

function rowContent({
  value,
  isSecret,
  isVisible,
  isPlaceholder,
  children,
}: Pick<TConnectRowProps, "value" | "isSecret" | "isPlaceholder" | "children"> & {
  isVisible: boolean;
}) {
  if (isPlaceholder) return "Loading connection";
  if (children !== undefined) return children;
  if (value === undefined) return null;
  if (isSecret && !isVisible) return maskUrlPassword(value);
  return value;
}

function ConnectRow({
  value,
  label,
  Icon,
  isSecret,
  isPlaceholder,
  isError,
  className,
  children,
}: TConnectRowProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isNote = value === undefined && !isPlaceholder;

  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      data-tone={isError ? "error" : isNote ? "note" : undefined}
      className={cn(
        "group/card bg-input data-[tone=error]:text-destructive data-[tone=note]:text-muted-foreground flex w-full items-stretch rounded-lg border p-0.5",
        className,
      )}
    >
      {label && (
        <p className="text-muted-foreground shrink-0 border-r px-2.5 py-2 font-mono text-sm leading-5">
          {label}
        </p>
      )}
      <p className="min-w-0 flex-1 px-2.5 py-2 font-mono text-sm leading-5 wrap-anywhere">
        {Icon && (
          <span className="inline-icon mr-1.5">
            <Icon className="size-4 shrink-0" />
          </span>
        )}
        <span className="group-data-placeholder/card:bg-foreground group-data-placeholder/card:animate-skeleton group-data-placeholder/card:rounded-sm group-data-placeholder/card:text-transparent">
          {rowContent({ value, isSecret, isVisible, isPlaceholder, children })}
        </span>
      </p>
      <div className="flex shrink-0 items-start self-start">
        {isSecret && (
          <Button
            type="button"
            aria-label={isVisible ? "Hide password" : "Show password"}
            data-visible={isVisible || undefined}
            onClick={() => setIsVisible((prev) => !prev)}
            variant="ghost"
            forceMinSize="medium"
            size="icon"
            disabled={isPlaceholder}
            fadeOnDisabled={false}
            className="text-muted-more-foreground group/button size-9 shrink-0 rounded-md group-data-placeholder/card:text-transparent"
          >
            <div className="relative size-4">
              <EyeIcon className="size-full group-data-visible/button:opacity-0" />
              <EyeOffIcon className="absolute top-0 left-0 size-full opacity-0 group-data-visible/button:opacity-100" />
              {isPlaceholder && (
                <div className="bg-muted-more-foreground animate-skeleton absolute top-0 left-0 size-full rounded-sm" />
              )}
            </div>
          </Button>
        )}
        {!isNote && (
          <CopyButton
            valueToCopy={value}
            isPlaceholder={isPlaceholder}
            className="size-9 shrink-0 rounded-md"
            classNameIcon="size-4"
          />
        )}
      </div>
    </div>
  );
}

function WaitingIcon({ className }: { className?: string }) {
  return <HourglassIcon className={cn("animate-hourglass", className)} />;
}
