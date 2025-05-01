"use client";
import { oAuthSignInAction } from "@/components/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState, useState } from "react";

type TProps = {
  className?: string;
};

export default function SignInForm({ className }: TProps) {
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [, action, isPending] = useActionState(
    () => oAuthSignInAction({ providerId: "dex", callbackUrl: pathname, email, password }),
    null,
  );

  return (
    <form className={cn("flex w-full max-w-xs flex-col gap-2", className)} action={action}>
      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        Icon={MailIcon}
        inputTitle="Email"
        layout="label-included"
        type="email"
      />
      <Input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        Icon={KeyRoundIcon}
        inputTitle="Password"
        layout="label-included"
        type="password"
      />
      <Button isPending={isPending}>Sign In</Button>
    </form>
  );
}
