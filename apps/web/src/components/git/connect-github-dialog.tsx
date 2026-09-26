"use client";

import ChoiceList, { type TChoice } from "@/components/git/choice-list";
import { connectGitHub, githubConnectedPath } from "@/components/git/connect-github";
import { useGithubAppsUtils } from "@/components/git/github-apps-provider";
import BrandIcon from "@/components/icons/brand";
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
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { BuildingIcon, LockIcon, PlusIcon, UserIcon, UsersIcon } from "lucide-react";
import { ReactElement, useState } from "react";

type TAccountType = "personal" | "organization";
const onlyMe = "me";

export type TConnectTeam = { id: string; name: string };

// From a team page the app is shared with that team, from the account page the user picks
export type TConnectSharing =
  | { mode: "team"; team: TConnectTeam | undefined }
  | { mode: "pick"; teams: TConnectTeam[] | undefined };

export function ConnectGithubCard({ sharing }: { sharing: TConnectSharing }) {
  return (
    <ConnectGithubTrigger sharing={sharing}>
      <Button
        variant="outline"
        className="text-muted-foreground flex w-full flex-row items-center justify-start rounded-xl px-4 py-3 font-medium"
      >
        <PlusIcon className="-my-1 -ml-1 size-4.5 shrink-0" />
        <p className="min-w-0 shrink truncate leading-tight">Connect GitHub</p>
      </Button>
    </ConnectGithubTrigger>
  );
}

export function ConnectGithubTrigger({
  sharing,
  handle,
  children,
}: {
  sharing: TConnectSharing;
  handle?: TDialogHandle;
  children: ReactElement;
}) {
  const [internalHandle] = useState(() => createDialogHandle());
  const dialogHandle = handle ?? internalHandle;
  const { invalidate } = useGithubAppsUtils();

  const teams = sharing.mode === "pick" ? sharing.teams : undefined;
  const [visibility, setVisibility] = useState(onlyMe);
  const sharedTeam =
    sharing.mode === "team" ? sharing.team : sharing.teams?.find((team) => team.id === visibility);
  const [accountType, setAccountType] = useState<TAccountType>("personal");
  const [organization, setOrganization] = useState("");
  const [isPending, setIsPending] = useState(false);

  const visibilityItems: TChoice[] | undefined = teams
    ? [
        {
          value: onlyMe,
          label: "Only me",
          description: "Only you can see these repositories.",
          Icon: LockIcon,
        },
        ...teams.map((team) => ({
          value: team.id,
          label: team.name,
          description: `Members of ${team.name} can see them too.`,
          Icon: UsersIcon,
        })),
      ]
    : undefined;
  const accountTypeItems: TChoice[] = [
    { value: "personal", label: "Personal", Icon: UserIcon },
    { value: "organization", label: "Organization", Icon: BuildingIcon },
  ];
  const organizationMissing = accountType === "organization" && organization.trim() === "";

  const reset = () => {
    setVisibility(onlyMe);
    setAccountType("personal");
    setOrganization("");
    setIsPending(false);
  };

  // The popup has to open inside the click, so this stays a plain handler
  const connect = async () => {
    if (organizationMissing || isPending) return;
    setIsPending(true);
    try {
      await connectGitHub({
        redirectUrl: window.location.origin + githubConnectedPath(),
        organizationName: accountType === "organization" ? organization.trim() : undefined,
        teamId: sharedTeam?.id,
        onSuccess: () => {
          invalidate();
          toast.add({
            type: "success",
            title: "GitHub connected",
            description: sharedTeam
              ? `Members of ${sharedTeam.name} can now see its repositories.`
              : "Only you can see its repositories.",
            timeout: 5000,
          });
        },
      });
      dialogHandle.close();
    } catch (error) {
      toast.add({
        type: "error",
        title: "Failed to connect GitHub",
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog
      handle={dialogHandle}
      onOpenChange={(open) => {
        if (!open) reset();
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent hideXButton className="w-full max-w-lg" classNameInnerWrapper="gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrandIcon brand="github" className="size-6" />
            Connect GitHub
          </DialogTitle>
          <DialogDescription>
            A GitHub App is created on your account or organization.
            {sharing.mode === "team" &&
              ` Members of ${sharing.team?.name ?? "this team"} can see its repositories.`}
          </DialogDescription>
        </DialogHeader>
        {sharing.mode === "pick" && (
          <Field label="Who should see the repositories?">
            <ChoiceList items={visibilityItems} value={visibility} onChange={setVisibility} />
          </Field>
        )}
        <Field label="GitHub Account">
          <ChoiceList
            items={accountTypeItems}
            value={accountType}
            onChange={(v) => setAccountType(v as TAccountType)}
          />
        </Field>
        {accountType === "organization" && (
          <Field label="Organization Name">
            <Input
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="my-organization"
              autoComplete="off"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                connect();
              }}
            />
          </Field>
        )}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button disabled={organizationMissing} isPending={isPending} onClick={connect}>
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col">
      <p className="px-1 pb-2.5 leading-tight font-medium">{label}</p>
      {children}
    </div>
  );
}
