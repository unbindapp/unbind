import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { getGoClient } from "@/lib/server/client";
import ErrorLine from "@/components/error-line";
import { AuthShell } from "../../components/auth-shell";
import { useAppForm } from "@/lib/hooks/use-app-form";
import { meQuery } from "@/lib/queries/me";

const formSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const Route = createFileRoute("/welcome/")({
  beforeLoad: async () => {
    // Account creation is only for the very first user.
    let firstUserCreated = false;
    const status = await getGoClient().setup.status();
    firstUserCreated = status.data.is_first_user_created;
    if (firstUserCreated) throw redirect({ to: "/sign-in" });
  },
  component: Welcome,
});

function Welcome() {
  const router = useRouter();
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
        const goClient = getGoClient();
        await goClient.setup.createUser({ email: value.email, password: value.password });
        await goClient.auth.login({ email: value.email, password: value.password });
        // Drop the stale "not signed in" cache and fetch /users/me fresh with the new
        // session cookie before navigating, so the root guard sees the signed-in user.
        queryClient.removeQueries({ queryKey: meQuery.queryKey });
        await queryClient.ensureQueryData(meQuery);
        router.history.push("/");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create account");
      }
    },
  });

  return (
    <AuthShell subtitle="Create an account to start">
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
              autoComplete="new-password"
            />
          )}
        />
        <form.Subscribe
          selector={(state) => state.isSubmitting}
          children={(isSubmitting) => (
            <form.SubmitButton className="mt-1.5" type="submit" isPending={isSubmitting}>
              Create Account
            </form.SubmitButton>
          )}
        />
        {error && <ErrorLine message={error} />}
      </form>
    </AuthShell>
  );
}
