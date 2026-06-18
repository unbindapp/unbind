import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { useState } from "react";

import { getGoClient } from "@/server/client";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "../../components/auth-shell";
import { meQuery } from "@/lib/queries/me";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  // TO-DO: Convert this to TanStack Form

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      const goClient = getGoClient();
      await goClient.setup.createUser({ email, password });
      await goClient.auth.login({ email, password });
      // Drop the stale "not signed in" cache and fetch /users/me fresh with the new
      // session cookie before navigating, so the root guard sees the signed-in user.
      queryClient.removeQueries({ queryKey: meQuery.queryKey });
      await queryClient.ensureQueryData(meQuery);
      router.history.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
      setIsPending(false);
    }
  }

  return (
    <AuthShell subtitle="Create an account to start">
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
          autoComplete="new-password"
        />
        <Button className="mt-1.5" type="submit" isPending={isPending}>
          Create Account
        </Button>
        {error && <ErrorLine message={error} />}
      </form>
    </AuthShell>
  );
}
