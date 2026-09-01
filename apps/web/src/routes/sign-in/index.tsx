import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import ErrorLine from "@/components/error-line";
import { AuthShell } from "../../components/auth-shell";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { meQuery } from "@/lib/queries/me";

const searchSchema = z.object({ redirect: z.string().optional() });

const formSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export const Route = createFileRoute("/sign-in/")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me) throw redirect({ to: "/" });

    // Setup gate: no first user yet → send to account creation.
    let firstUserCreated = true;
    try {
      const status = await getGoClient().setup.status();
      firstUserCreated = status.data.is_first_user_created;
    } catch {
      // API unreachable — fall through to the sign-in form.
    }
    if (!firstUserCreated) throw redirect({ to: "/welcome" });
  },
  component: SignIn,
});

function SignIn() {
  const router = useRouter();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onSubmit: formSchema,
    },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await getGoClient().auth.login({ email: value.email, password: value.password });
        // Drop the stale "not signed in" cache and fetch /users/me fresh with the new
        // session cookie before navigating, so the root guard sees the signed-in user.
        queryClient.removeQueries({ queryKey: meQuery.queryKey });
        await queryClient.ensureQueryData(meQuery);
        router.history.push(search.redirect ?? "/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to sign in");
      }
    },
  });

  return (
    <AuthShell subtitle="Sign in to continue">
      <form
        className="mt-5 flex w-full max-w-xs flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(e);
        }}
      >
        <form.AppField
          name="email"
          children={(field) => (
            <field.TextField
              field={field}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              Icon={MailIcon}
              inputTitle="Email"
              layout="label-included"
              type="email"
              autoComplete="email"
            />
          )}
        />
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
              autoComplete="current-password"
            />
          )}
        />
        <form.Subscribe
          selector={(state) => state.isSubmitting}
          children={(isSubmitting) => (
            <form.SubmitButton className="mt-1.5" type="submit" isPending={isSubmitting}>
              Sign In
            </form.SubmitButton>
          )}
        />
        {error && <ErrorLine message={error} />}
      </form>
    </AuthShell>
  );
}
