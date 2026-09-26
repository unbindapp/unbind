"use client";

import ChoiceList, { type TChoice } from "@/components/git/choice-list";
import { connectGitHub, githubConnectedPath } from "@/components/git/connect-github";
import { useGithubAppsUtils } from "@/components/git/github-apps-provider";
import BrandIcon from "@/components/icons/brand";
import { useTeam } from "@/components/team/team-provider";
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

type TVisibility = "me" | "team";
type TAccountType = "personal" | "organization";

export function ConnectGithubCard({ teamId }: { teamId: string }) {
  return (
    <ConnectGithubTrigger teamId={teamId}>
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
  teamId,
  handle,
  children,
}: {
  teamId: string;
  handle?: TDialogHandle;
  children: ReactElement;
}) {
  const [internalHandle] = useState(() => createDialogHandle());
  const dialogHandle = handle ?? internalHandle;
  const {
    query: { data: teamData },
  } = useTeam();
  const teamName = teamData?.team.name ?? "this team";
  const { invalidate } = useGithubAppsUtils();

  const [visibility, setVisibility] = useState<TVisibility>("me");
  const [accountType, setAccountType] = useState<TAccountType>("personal");
  const [organization, setOrganization] = useState("");
  const [isPending, setIsPending] = useState(false);

  const visibilityItems: TChoice[] = [
    {
      value: "me",
      label: "Only me",
      description: "Only you can pick these repositories.",
      Icon: LockIcon,
    },
    {
      value: "team",
      label: teamName,
      description: `Members of ${teamName} can pick them too.`,
      Icon: UsersIcon,
    },
  ];
  const accountTypeItems: TChoice[] = [
    { value: "personal", label: "Personal", Icon: UserIcon },
    { value: "organization", label: "Organization", Icon: BuildingIcon },
  ];
  const organizationMissing = accountType === "organization" && organization.trim() === "";

  const reset = () => {
    setVisibility("me");
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
        redirectUrl: window.location.origin + githubConnectedPath(teamId),
        organizationName: accountType === "organization" ? organization.trim() : undefined,
        teamId: visibility === "team" ? teamId : undefined,
        onSuccess: () => {
          invalidate();
          toast.add({
            type: "success",
            title: "GitHub connected",
            description:
              visibility === "team"
                ? `Members of ${teamName} can now pick its repositories.`
                : "Only you can pick its repositories.",
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
      <DialogContent classNameInnerWrapper="gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrandIcon brand="github" className="size-6" />
            Connect GitHub
          </DialogTitle>
          <DialogDescription>
            A GitHub App is created on your account or organization. Pick the repositories it can
            reach when GitHub asks.
          </DialogDescription>
        </DialogHeader>
        <Field label="Who can see the repositories?">
          <ChoiceList
            items={visibilityItems}
            value={visibility}
            onChange={(v) => setVisibility(v as TVisibility)}
          />
        </Field>
        <Field label="GitHub account">
          <ChoiceList
            items={accountTypeItems}
            value={accountType}
            onChange={(v) => setAccountType(v as TAccountType)}
          />
        </Field>
        {accountType === "organization" && (
          <Field label="Organization name">
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
      <p className="mb-1.5 px-1 text-sm leading-tight font-medium">{label}</p>
      {children}
    </div>
  );
}
