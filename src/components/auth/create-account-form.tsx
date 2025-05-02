"use client";

import { errorCodeToText } from "@/components/auth/helpers";
import HiddenSignInForm from "@/components/auth/hidden-sign-in-form";
import { TSignInLikeFormProps } from "@/components/auth/types";
import useSignInLikeForm from "@/components/auth/use-sign-in-like-form";
import { createFirstAccountAction } from "@/components/auth/actions";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { useActionState } from "react";

export default function CreateAccountForm({
  formValues,
  error,
  loginUrl,
  redirectPathname,
  className,
}: TSignInLikeFormProps) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    hasHiddenForm,
    isHiddenFormSubmitting,
    hiddenFormRef,
  } = useSignInLikeForm({ formValues, error });

  const [state, action, isPending] = useActionState(
    () => createFirstAccountAction({ providerId: "dex", redirectPathname, email, password }),
    null,
  );

  return (
    <>
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
        <Button className="mt-1.5" isPending={isPending || hasHiddenForm || isHiddenFormSubmitting}>
          Create Account
        </Button>
        {error && <ErrorLine message={errorCodeToText(error)} />}
        {state?.error && <ErrorLine message={errorCodeToText(state.error.code)} />}
      </form>
      {/* Hidden form */}
      {hasHiddenForm && (
        <HiddenSignInForm formValues={formValues} loginUrl={loginUrl} ref={hiddenFormRef} />
      )}
    </>
  );
}
