"use client";

import { signOutAction } from "@/components/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";
import { useActionState } from "react";

type Props = {
  callbackUrl?: string;
  className?: string;
};

export default function SignOutButton({ callbackUrl, className }: Props) {
  const [, action, isPending] = useActionState(
    () => signOutAction({ callbackUrl }),
    null
  );

  return (
    <form className={cn("w-full", className)} action={action}>
      <Button
        className="w-full px-10"
        state={isPending ? "loading" : undefined}
      >
        <div className="absolute left-2.25 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center">
          {isPending && <LoaderIcon className="size-full p-0.5 animate-spin" />}
        </div>
        Sign Out
      </Button>
    </form>
  );
}
