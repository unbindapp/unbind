"use client";

import { signOutAction } from "@/components/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";
import { useActionState } from "react";

type TProps = {
  callbackUrl?: string;
  className?: string;
};

export default function SignOutButton({ callbackUrl, className }: TProps) {
  const [, action, isPending] = useActionState(() => signOutAction({ callbackUrl }), null);

  return (
    <form className={cn("w-full", className)} action={action}>
      <Button className="w-full px-10" state={isPending ? "loading" : undefined}>
        <div className="absolute top-1/2 left-2.5 flex size-6 -translate-y-1/2 items-center justify-center">
          {isPending && <LoaderIcon className="size-full animate-spin p-0.5" />}
        </div>
        Sign Out
      </Button>
    </form>
  );
}
