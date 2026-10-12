"use client";

import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import RoleSelect from "@/components/team/settings/members/role-select";
import { useTeamMembersUtils } from "@/components/team/settings/members/team-members-provider";
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
import { toast } from "@/components/ui/toast";
import { defaultAnimationMs } from "@/lib/constants";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { inviteTeamMember as inviteTeamMemberFn, type TTeamInvitation } from "@/lib/queries/teams";
import type { PermittedAction } from "@/lib/server/client.gen";
import { useMutation } from "@tanstack/react-query";
import { ReactElement, useRef, useState } from "react";
import { z } from "zod";

type TProps = {
  teamId: string;
  children: ReactElement;
};

export default function InviteMemberDialog({ teamId, children }: TProps) {
  const { invalidate } = useTeamMembersUtils();
  const [open, setOpen] = useState(false);
  const [invitation, setInvitation] = useState<TTeamInvitation | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    mutateAsync: invite,
    error: inviteError,
    reset: inviteReset,
  } = useMutation({
    mutationFn: inviteTeamMemberFn,
  });

  const form = useAppForm({
    defaultValues: { email: "", role: "viewer" as PermittedAction },
    validators: {
      onChange: z
        .object({
          email: z.string().trim().email("Enter a valid email address."),
          role: z.enum(["admin", "editor", "viewer"]),
        })
        .strip(),
    },
    onSubmit: async ({ formApi, value }) => {
      const res = await invite({ teamId, email: value.email, role: value.role });
      await invalidate();
      formApi.reset();
      if (res.data.invitation) {
        setInvitation(res.data.invitation);
        return;
      }
      setOpen(false);
      toast.add({
        type: "success",
        title: "Added",
        description: `${res.data.member?.email} already had an account and is now on the team.`,
      });
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) return;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          form.reset();
          inviteReset();
          setInvitation(null);
        }, defaultAnimationMs);
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent hideXButton classNameInnerWrapper="w-128 max-w-full">
        {invitation ? (
          <>
            <DialogHeader>
              <DialogTitle>Invitation Created</DialogTitle>
              <DialogDescription>
                {invitation.email_sent
                  ? `An email with this link went to ${invitation.email}. You can also share it yourself.`
                  : `Email is not set up on this instance, so share this link with ${invitation.email} yourself.`}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-background-hover flex w-full items-center gap-1 rounded-lg border py-1 pr-1 pl-3">
              <p className="min-w-0 flex-1 truncate font-mono text-sm select-all">
                {invitation.invite_url}
              </p>
              <CopyButton valueToCopy={invitation.invite_url} />
            </div>
            <p className="text-muted-foreground mt-3 text-sm">
              The link expires in 7 days and works once.
            </p>
            <div className="mt-4 flex w-full justify-end">
              <DialogClose render={<Button type="button">Done</Button>} />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
              <DialogDescription>
                An existing account is added right away. A new one gets an invitation link.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit(e);
              }}
              className="flex flex-col"
            >
              <div className="flex w-full items-start gap-2">
                <form.AppField
                  name="email"
                  children={(field) => (
                    <field.TextField
                      autoCapitalize="none"
                      autoComplete="off"
                      dontCheckUntilSubmit
                      field={field}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="min-w-0 flex-1"
                      placeholder="person@example.com"
                    />
                  )}
                />
                <form.AppField
                  name="role"
                  children={(field) => (
                    <RoleSelect
                      value={field.state.value}
                      onChange={(role) => field.handleChange(role)}
                      className="h-10 shrink-0 rounded-lg"
                    />
                  )}
                />
              </div>
              {inviteError && <ErrorLine message={inviteError.message} className="mt-4" />}
              <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
                <DialogClose
                  className="text-muted-foreground"
                  render={
                    <Button type="button" variant="ghost">
                      Cancel
                    </Button>
                  }
                />
                <form.Subscribe
                  selector={(state) => ({ isSubmitting: state.isSubmitting })}
                  children={({ isSubmitting }) => (
                    <form.SubmitButton
                      data-submitting={isSubmitting || undefined}
                      isPending={isSubmitting ? true : false}
                    >
                      Invite
                    </form.SubmitButton>
                  )}
                />
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
