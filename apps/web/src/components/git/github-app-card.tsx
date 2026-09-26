"use client";

import { Chip } from "@/components/api-key/access-chips";
import ChoiceList, { type TChoice } from "@/components/git/choice-list";
import { useGithubAppsUtils } from "@/components/git/github-apps-provider";
import BrandIcon from "@/components/icons/brand";
import { NewEntityIndicator } from "@/components/new-entity-indicator";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import {
  createDialogHandle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  TDialogHandle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ErrorLine from "@/components/error-line";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import {
  deleteGitApp as deleteGitAppFn,
  deleteGitInstallation as deleteGitInstallationFn,
  gitAppInstallUrl,
  gitAppSettingsUrl,
  gitInstallationSettingsUrl,
  setGitAppTeam as setGitAppTeamFn,
  type TGitApp,
  type TGitInstallation,
} from "@/lib/queries/git";
import { meQuery } from "@/lib/queries/me";
import { teamsListQuery } from "@/lib/queries/teams";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Building2Icon,
  CircleAlertIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  LockIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
  UserRoundXIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { ReactNode, useState } from "react";

export type TGithubAppCardView = "account" | "team";

type TProps =
  | { app: TGitApp; view: TGithubAppCardView; canEditTeam?: boolean; isPlaceholder?: never }
  | { app?: never; view: TGithubAppCardView; canEditTeam?: never; isPlaceholder: true };

const placeholderTime = new Date("2020-01-01T00:00:00Z");

export default function GithubAppCard({ app, view, canEditTeam, isPlaceholder }: TProps) {
  const { data: me } = useQuery(meQuery);
  const isOwner = !!app && !!me && app.created_by === me.id;
  const ownerGone = !!app && !app.created_by;
  const canManage = isOwner || (ownerGone && !!canEditTeam);

  return (
    <div
      data-placeholder={isPlaceholder || undefined}
      className="group/item relative flex flex-col items-start justify-start gap-3 rounded-xl border p-3 sm:p-4 sm:pt-3.5"
    >
      {app && <NewEntityIndicator id={app.uuid} />}
      <div className="flex w-full items-start justify-start gap-1.5 px-0.5 pr-10 leading-tight">
        <div className="line-icon">
          <BrandIcon
            brand="github"
            color="brand"
            className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground size-4.5 group-data-placeholder/item:rounded-full"
          />
        </div>
        <div className="flex min-w-0 shrink flex-wrap items-center gap-x-2 gap-y-1">
          <p className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground min-w-0 shrink font-medium group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
            {app ? app.name : "Loading connection"}
          </p>
          {!app || !app.team_id ? (
            <Chip>
              <LockIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
              Only you
            </Chip>
          ) : (
            <Chip className="text-process bg-process/4-10 border-process/4-10 font-medium">
              <UsersIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
              {app.team_name ?? "Team"}
            </Chip>
          )}
          {ownerGone && (
            <Chip className="text-warning bg-warning/4-10 border-warning/4-10 font-medium">
              <UserRoundXIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
              Owner removed
            </Chip>
          )}
        </div>
      </div>
      <ol className="flex w-full flex-col gap-1.5">
        {app ? (
          app.installations.length === 0 ? (
            <li className="text-muted-foreground flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-sm leading-tight">
              <CircleAlertIcon className="size-4 shrink-0" />
              <p className="min-w-0 shrink">Not installed on any account yet</p>
            </li>
          ) : (
            app.installations.map((installation) => (
              <InstallationRow
                key={installation.id}
                app={app}
                installation={installation}
                canManage={canManage}
              />
            ))
          )
        ) : (
          <InstallationRow isPlaceholder />
        )}
      </ol>
      <p className="text-muted-foreground group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-muted-foreground max-w-full min-w-0 shrink px-0.75 text-sm leading-tight group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent">
        {app && view === "team" && (
          <>
            <span>Connected by {app.created_by_email ?? "a removed user"}</span>
            <span className="text-muted-more-foreground hidden px-[0.75ch] sm:inline">|</span>
          </>
        )}
        <span className="mt-1 block sm:mt-0 sm:inline">
          Connected at{" "}
          {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(app?.created_at || placeholderTime),
          )}
        </span>
      </p>
      {!app ? (
        <Button
          disabled
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 rounded-lg"
        >
          <div className="bg-muted-more-foreground animate-skeleton size-6 rounded-md" />
        </Button>
      ) : (
        <ThreeDotButton
          app={app}
          view={view}
          isOwner={isOwner}
          canManage={canManage}
          canUnshare={isOwner || (!!app.team_id && !!canEditTeam)}
          className="absolute top-1 right-1"
        />
      )}
    </div>
  );
}

function InstallationRow({
  app,
  installation,
  canManage,
}:
  | { app: TGitApp; installation: TGitInstallation; canManage: boolean; isPlaceholder?: never }
  | { app?: never; installation?: never; canManage?: never; isPlaceholder: true }) {
  const AccountIcon = installation?.account_type === "Organization" ? Building2Icon : UserIcon;
  const serviceCount = installation?.service_count ?? 0;
  return (
    <li className="flex w-full items-center gap-2 rounded-lg border py-1.5 pr-1.5 pl-3 text-sm leading-tight">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-1">
        <a
          href={installation?.account_url}
          target="_blank"
          rel="noreferrer noopener"
          className="group-data-placeholder/item:animate-skeleton group-data-placeholder/item:bg-foreground flex max-w-full min-w-0 items-center gap-1.5 font-medium group-data-placeholder/item:rounded-sm group-data-placeholder/item:text-transparent has-hover:hover:underline"
        >
          <AccountIcon className="size-4 shrink-0 group-data-placeholder/item:invisible" />
          <span className="min-w-0 truncate">
            {installation ? installation.account_login : "loading-account"}
          </span>
        </a>
        <Chip>
          {installation?.repository_selection === "selected"
            ? "Selected repositories"
            : "All repositories"}
        </Chip>
        <Chip>
          {serviceCount} {serviceCount === 1 ? "service" : "services"}
        </Chip>
        {installation && !installation.active && (
          <Chip className="text-destructive bg-destructive/4-10 border-destructive/4-10 font-medium">
            <CircleAlertIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
            Uninstalled on GitHub
          </Chip>
        )}
        {installation && installation.active && installation.suspended && (
          <Chip className="text-warning bg-warning/4-10 border-warning/4-10 font-medium">
            <CircleAlertIcon className="mr-1 mb-0.5 -ml-0.5 inline-block size-3" />
            Suspended
          </Chip>
        )}
      </div>
      {installation && (
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Configure on GitHub"
            className="text-muted-more-foreground size-8 rounded-md"
            render={
              <a
                href={gitInstallationSettingsUrl(installation)}
                target="_blank"
                rel="noreferrer noopener"
              />
            }
          >
            <ExternalLinkIcon className="size-4.5" />
          </Button>
          {canManage && <RemoveInstallationTrigger app={app} installation={installation} />}
        </div>
      )}
    </li>
  );
}

function RemoveInstallationTrigger({
  app,
  installation,
}: {
  app: TGitApp;
  installation: TGitInstallation;
}) {
  const { invalidate } = useGithubAppsUtils();
  const {
    mutateAsync: deleteInstallation,
    error,
    reset,
  } = useMutation({ mutationFn: deleteGitInstallationFn });
  return (
    <DeleteEntityTrigger
      dialogTitle="Remove Account"
      dialogDescription={
        <>
          {app.name} is uninstalled from {installation.account_login} on GitHub.{" "}
          <ServicesNote count={installation.service_count} />
        </>
      }
      deletingEntityName={installation.account_login}
      textToConfirm={`Remove ${installation.account_login}`}
      submitButtonText="Remove"
      error={error}
      onDialogClose={reset}
      onSubmit={async () => {
        await deleteInstallation({ installationId: installation.id });
        await invalidate();
      }}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${installation.account_login}`}
        className="text-muted-more-foreground has-hover:hover:text-destructive active:text-destructive size-8 rounded-md"
      >
        <Trash2Icon className="size-4.5" />
      </Button>
    </DeleteEntityTrigger>
  );
}

function ServicesNote({ count }: { count: number }) {
  if (count === 0) return <>No service builds from it.</>;
  return (
    <>
      {count} {count === 1 ? "service builds" : "services build"} from it. They keep running but
      stop deploying on push until a repository is picked for them again.
    </>
  );
}

function ThreeDotButton({
  app,
  view,
  isOwner,
  canManage,
  canUnshare,
  className,
}: {
  app: TGitApp;
  view: TGithubAppCardView;
  isOwner: boolean;
  canManage: boolean;
  canUnshare: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sharingHandle] = useState(() => createDialogHandle());
  const [unshareHandle] = useState(() => createDialogHandle());
  const [deleteHandle] = useState(() => createDialogHandle());

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Connection options"
              data-open={isOpen || undefined}
              fadeOnDisabled={false}
              variant="ghost"
              size="icon"
              className={cn("text-muted-more-foreground group/button rounded-lg", className)}
            >
              <EllipsisVerticalIcon className="size-6 transition-transform group-data-open/button:rotate-90" />
            </Button>
          }
        />
        <DropdownMenuContent
          className="z-50 w-64"
          sideOffset={-1}
          data-open={isOpen || undefined}
          align="end"
          keepMounted
        >
          <ScrollArea>
            <DropdownMenuGroup>
              {/* The dialogs live outside the menu; nested inside the open modal menu they would be inert */}
              {view === "account" && isOwner && (
                <DialogTrigger
                  nativeButton={false}
                  handle={sharingHandle}
                  render={
                    <DropdownMenuItem>
                      <UsersIcon className="-ml-0.5 size-5" />
                      <p className="min-w-0 shrink leading-tight">Sharing</p>
                    </DropdownMenuItem>
                  }
                />
              )}
              {view === "team" && canUnshare && (
                <DialogTrigger
                  nativeButton={false}
                  handle={unshareHandle}
                  render={
                    <DropdownMenuItem>
                      <XIcon className="-ml-0.5 size-5" />
                      <p className="min-w-0 shrink leading-tight">Remove from team</p>
                    </DropdownMenuItem>
                  }
                />
              )}
              {canManage && (
                <DropdownMenuItem
                  render={
                    <a href={gitAppInstallUrl(app)} target="_blank" rel="noreferrer noopener" />
                  }
                >
                  <PlusIcon className="-ml-0.5 size-5" />
                  <p className="min-w-0 shrink leading-tight">Install on another account</p>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                render={
                  <a href={gitAppSettingsUrl(app)} target="_blank" rel="noreferrer noopener" />
                }
              >
                <ExternalLinkIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Open on GitHub</p>
              </DropdownMenuItem>
              {canManage && (
                <DialogTrigger
                  nativeButton={false}
                  handle={deleteHandle}
                  render={
                    <DropdownMenuItem className="text-destructive active:bg-destructive/4-10 data-highlighted:bg-destructive/4-10 data-highlighted:text-destructive">
                      <Trash2Icon className="-ml-0.5 size-5" />
                      <p className="min-w-0 shrink leading-tight">Remove</p>
                    </DropdownMenuItem>
                  }
                />
              )}
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
      {view === "account" && isOwner && <SharingDialog app={app} handle={sharingHandle} />}
      {view === "team" && canUnshare && <UnshareTrigger app={app} handle={unshareHandle} />}
      {canManage && <DeleteAppTrigger app={app} handle={deleteHandle} />}
    </>
  );
}

const onlyMe = "only-me";

function SharingDialog({ app, handle }: { app: TGitApp; handle: TDialogHandle }) {
  const { invalidate } = useGithubAppsUtils();
  const {
    data: teamsData,
    isPending: isPendingTeams,
    error: teamsError,
  } = useQuery(teamsListQuery());
  const [value, setValue] = useState(app.team_id ?? onlyMe);
  const {
    mutateAsync: setTeam,
    isPending,
    error,
    reset,
  } = useMutation({ mutationFn: setGitAppTeamFn });

  const items: TChoice[] | undefined = teamsData
    ? [
        { value: onlyMe, label: "Only me", Icon: LockIcon },
        ...teamsData.teams
          .filter((team) => team.permissions.includes("editor") || team.id === app.team_id)
          .map((team) => ({ value: team.id, label: team.name, Icon: UsersIcon })),
      ]
    : undefined;
  const isUnchanged = value === (app.team_id ?? onlyMe);

  return (
    <Dialog
      handle={handle}
      onOpenChange={(open) => {
        if (open) return;
        setValue(app.team_id ?? onlyMe);
        reset();
      }}
    >
      <DialogContent classNameInnerWrapper="gap-4">
        <DialogHeader>
          <DialogTitle>Sharing</DialogTitle>
          <DialogDescription>
            Members of the team can pick the repositories of {app.name} for their services.
          </DialogDescription>
        </DialogHeader>
        <ChoiceList
          items={items}
          value={value}
          onChange={setValue}
          isPending={isPendingTeams}
          error={teamsError?.message}
        />
        {error && <ErrorLine message={error.message} />}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            disabled={isUnchanged}
            isPending={isPending}
            onClick={async () => {
              await setTeam({ uuid: app.uuid, teamId: value === onlyMe ? null : value });
              await invalidate();
              handle.close();
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UnshareTrigger({ app, handle }: { app: TGitApp; handle: TDialogHandle }) {
  const { invalidate } = useGithubAppsUtils();
  const { mutateAsync: setTeam, error, reset } = useMutation({ mutationFn: setGitAppTeamFn });
  return (
    <DeleteEntityTrigger
      dialogTitle="Remove from Team"
      dialogDescription="Members of the team can no longer pick its repositories. Services already built from it keep deploying."
      deletingEntityName={app.name}
      disableConfirmationInput
      submitButtonText="Remove"
      variant="warning"
      handle={handle}
      error={error}
      onDialogClose={reset}
      onSubmit={async () => {
        await setTeam({ uuid: app.uuid, teamId: null });
        await invalidate();
      }}
    />
  );
}

function DeleteAppTrigger({ app, handle }: { app: TGitApp; handle: TDialogHandle }) {
  const { invalidate } = useGithubAppsUtils();
  const { mutateAsync: deleteApp, error, reset } = useMutation({ mutationFn: deleteGitAppFn });
  const serviceCount = app.installations.reduce((sum, i) => sum + i.service_count, 0);
  return (
    <DeleteEntityTrigger
      dialogTitle="Remove GitHub Connection"
      dialogDescription={
        <>
          {app.name} is uninstalled from every account. <ServicesNote count={serviceCount} />{" "}
          Afterwards delete the app itself{" "}
          <ExternalTextLink href={gitAppSettingsUrl(app)}>on GitHub</ExternalTextLink>.
        </>
      }
      deletingEntityName={app.name}
      textToConfirm={`Remove ${app.name}`}
      submitButtonText="Remove"
      handle={handle}
      error={error}
      onDialogClose={reset}
      onSubmit={async () => {
        await deleteApp({ uuid: app.uuid });
        await invalidate();
      }}
    />
  );
}

function ExternalTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-foreground font-medium underline"
    >
      {children}
    </a>
  );
}
