import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { KeyRoundIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { AuthShell } from "@/components/auth-shell";
import ErrorLine from "@/components/error-line";
import { Button, LinkButton } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { meQuery } from "@/lib/queries/me";
import { getGoClient } from "@/lib/server/client";
import type { InvitationPreviewResponse } from "@/lib/server/client.gen";

export const Route = createFileRoute("/invite/$token")({
  component: Invite,
});

function Invite() {
  const { token } = Route.useParams();
  const { data, isPending, error } = useQuery({
    queryKey: ["invitations", "preview", token],
    queryFn: async () => {
      const res = await getGoClient().invitations.get({ token });
      return res.data;
    },
    retry: false,
  });

  if (isPending) {
    return <AuthShell subtitle="Loading your invitation">{null}</AuthShell>;
  }

  if (!data) {
    return (
      <AuthShell subtitle="This invitation is no longer valid">
        <div className="mt-5 flex w-full max-w-xs flex-col gap-3">
          <ErrorLine message={error?.message} />
          <p className="text-muted-foreground px-1 text-center text-sm">
            Ask the person who invited you for a new link.
          </p>
          <LinkButton to="/sign-in" variant="outline">
            Go to Sign In
          </LinkButton>
        </div>
      </AuthShell>
    );
  }

  return <AcceptForm token={token} invitation={data} />;
}

const formSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

function AcceptForm({
  token,
  invitation,
}: {
  token: string;
  invitation: InvitationPreviewResponse;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const needsPassword = !invitation.account_exists;

  const form = useAppForm({
    defaultValues: { password: "" },
    validators: needsPassword ? { onSubmit: formSchema } : undefined,
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await getGoClient().invitations.accept({
          token,
          ...(needsPassword ? { password: value.password } : {}),
        });
        const me = await queryClient.ensureQueryData(meQuery);
        if (me && me.email.toLowerCase() === invitation.email.toLowerCase()) {
          await queryClient.invalidateQueries({ queryKey: ["teams"] });
          router.history.push("/");
          return;
        }
        toast.add({
          type: "success",
          title: `You joined ${invitation.team_name}`,
          description: `Sign in with ${invitation.email} to continue.`,
        });
        router.history.push("/sign-in");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept the invitation");
      }
    },
  });

  return (
    <AuthShell subtitle={`You were invited to ${invitation.team_name}`}>
      <form
        className="mt-5 flex w-full max-w-xs flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(e);
        }}
      >
        <p className="text-muted-foreground px-1 pb-1 text-center text-sm">
          <span className="text-foreground font-medium">{invitation.email}</span> joins as{" "}
          <span className="text-foreground font-medium">{invitation.role}</span>.
          {needsPassword ? " Choose a password to create your account." : ""}
        </p>
        {needsPassword && (
          <form.AppField
            name="password"
            children={(field) => (
              <field.TextField
                field={field}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                Icon={KeyRoundIcon}
                inputTitle="Password"
                layout="label-included"
                type="password"
                autoComplete="new-password"
              />
            )}
          />
        )}
        <form.Subscribe
          selector={(state) => state.isSubmitting}
          children={(isSubmitting) => (
            <form.SubmitButton className="mt-1.5" type="submit" isPending={isSubmitting}>
              {needsPassword ? "Accept and Create Account" : "Accept Invitation"}
            </form.SubmitButton>
          )}
        />
        {error && <ErrorLine message={error} />}
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground mt-1"
          render={<Link to="/sign-in" />}
        >
          Go to Sign In
        </Button>
      </form>
    </AuthShell>
  );
}
