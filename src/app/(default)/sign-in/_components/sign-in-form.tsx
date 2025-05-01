"use client";

import { TFormValues } from "@/app/(default)/sign-in/page";
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

  const [, action, isPending] = useActionState(
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
        <Button className="mt-2" isPending={isPending || hasHiddenForm || isHiddenFormSubmitting}>
          Sign In
        </Button>
        {error && <ErrorLine message={errorCodeToText(error)} />}
      </form>
      {/* Hidden form */}
      {hasHiddenForm && (
        <form
          action={loginUrl}
          method="POST"
          ref={hiddenFormRef}
          className="size-0 overflow-hidden opacity-0"
        >
          <input type="hidden" name="username" value={formValues.username} />
          <input type="hidden" name="password" value={formValues.password} />
          <input type="hidden" name="client_id" value={formValues.client_id} />
          <input type="hidden" name="response_type" value={formValues.response_type} />
          <input type="hidden" name="state" value={formValues.state} />
          <input type="hidden" name="scope" value={formValues.scope} />
          <input type="hidden" name="page_key" value={formValues.page_key} />
          <input type="hidden" name="redirect_uri" value={formValues.redirect_uri} />
        </form>
      )}
    </>
  );
}

function errorCodeToText(error: string) {
  switch (error) {
    case "invalid_request":
      return "Invalid request.";
    case "invalid_client":
      return "Invalid client.";
    case "invalid_grant":
      return "Invalid grant.";
    case "unauthorized_client":
      return "Unauthorized client.";
    case "unsupported_grant_type":
      return "Unsupported grant type.";
    case "invalid_scope":
      return "Invalid scope.";
    case "invalid_credentials":
      return "Invalid credentials.";
    default:
      return error;
  }
}
