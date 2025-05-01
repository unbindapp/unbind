"use client";

import { errorCodeToText } from "@/app/(default)/sign-in/_components/helpers";
import HiddenSignInForm, {
  TFormValues,
} from "@/app/(default)/sign-in/_components/hidden-sign-in-form";
import { oAuthSignInAction } from "@/components/auth/actions";
import ErrorLine from "@/components/error-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { KeyRoundIcon, MailIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

type TProps = {
  className?: string;
  redirectPathname?: string;
  formValues: TFormValues;
  loginUrl: string;
  error: string | undefined;
};

export default function SignInForm({
  formValues,
  error,
  loginUrl,
  redirectPathname,
  className,
}: TProps) {
  const hasHiddenForm =
    formValues.username &&
    formValues.password &&
    formValues.client_id &&
    formValues.response_type &&
    !error
      ? true
      : undefined;

  const [email, setEmail] = useState<string>(hasHiddenForm ? formValues.username || "" : "");
  const [password, setPassword] = useState<string>(hasHiddenForm ? formValues.password || "" : "");

  const [state, action, isPending] = useActionState(
    () => oAuthSignInAction({ providerId: "dex", redirectPathname, email, password }),
    null,
  );

  const hiddenFormRef = useRef<HTMLFormElement>(null);
  const [isHiddenFormSubmitting, setIsHiddenFormSubmitting] = useState(false);

  useEffect(() => {
    if (!hasHiddenForm) return;
    if (isHiddenFormSubmitting) return;
    if (!hiddenFormRef.current) return;

    setIsHiddenFormSubmitting(true);
    hiddenFormRef.current.submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHiddenForm]);

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
          Sign In
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
