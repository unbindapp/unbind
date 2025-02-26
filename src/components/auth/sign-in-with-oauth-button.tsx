"use client";

import { oAuthSignInAction } from "@/components/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState } from "react";

type Props = {
  providerId: string;
  providerName?: string;
  callbackUrl?: string;
  className?: string;
};

export default function SignInWithOAuthButton({
  providerId,
  providerName,
  callbackUrl,
  className,
}: Props) {
  const pathname = usePathname();
  const [, action, isPending] = useActionState(
    () =>
      oAuthSignInAction({ providerId, callbackUrl: callbackUrl || pathname }),
    null
  );

  return (
    <form className={cn("w-full", className)} action={action}>
      <Button
        type="submit"
        className="w-full px-10"
        state={isPending ? "loading" : undefined}
      >
        <div className="absolute left-2.25 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center">
          {isPending && <LoaderIcon className="size-full p-0.5 animate-spin" />}
        </div>
        {providerName ? `Sign in with ${providerName}` : "Sign in"}
      </Button>
    </form>
  );
}
