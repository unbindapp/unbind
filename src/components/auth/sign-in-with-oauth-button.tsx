"use client";

import { oAuthSignInAction } from "@/components/auth/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { LoaderIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState } from "react";

type TProps = {
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
}: TProps) {
  const pathname = usePathname();
  const [, action, isPending] = useActionState(
    () => oAuthSignInAction({ providerId, callbackUrl: callbackUrl || pathname }),
    null,
  );

  return (
    <form className={cn("w-full", className)} action={action}>
      <Button type="submit" className="w-full px-10" state={isPending ? "loading" : undefined}>
        <div className="absolute top-1/2 left-2.5 flex size-6 -translate-y-1/2 items-center justify-center">
          {isPending && <LoaderIcon className="size-full animate-spin p-0.25" />}
        </div>
        {providerName ? `Continue with ${providerName}` : "Sign in"}
      </Button>
    </form>
  );
}
