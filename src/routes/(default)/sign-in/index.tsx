import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { getSetupStatus, login, meQuery } from "@/api/auth";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "../-components/auth-shell";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/(default)/sign-in/")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me) throw redirect({ to: "/" });

    // Setup gate: no first user yet → send to account creation.
    let firstUserCreated = true;
    try {
      const status = await getSetupStatus();
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await login(email, password);
      // Drop the stale "not signed in" cache and fetch /users/me fresh with the new
      // session cookie before navigating, so the _authed guard sees the signed-in user.
      queryClient.removeQueries({ queryKey: meQuery.queryKey });
      await queryClient.ensureQueryData(meQuery);
      router.history.push(search.redirect ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setIsPending(false);
    }
  }

  return (
    <AuthShell subtitle="Sign in to continue">
      <form className="mt-5 flex w-full max-w-xs flex-col gap-2" onSubmit={onSubmit}>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          Icon={MailIcon}
          inputTitle="Email"
          layout="label-included"
          type="email"
          autoComplete="email"
        />
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          Icon={KeyRoundIcon}
          inputTitle="Password"
          layout="label-included"
          type="password"
          autoComplete="current-password"
        />
        <Button className="mt-1.5" type="submit" isPending={isPending}>
          Sign In
        </Button>
        {error && <ErrorLine message={error} />}
      </form>
    </AuthShell>
  );
}
