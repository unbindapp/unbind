import { TFormValues } from "@/app/(default)/sign-in/_components/types";
import React from "react";

export default function HiddenSignInForm({
  formValues,
  loginUrl,
  ref,
}: {
  formValues: TFormValues;
  loginUrl: string;
  ref: React.Ref<HTMLFormElement>;
}) {
  return (
    <form action={loginUrl} method="POST" ref={ref} className="size-0 overflow-hidden opacity-0">
      <input type="hidden" name="username" value={formValues.username} />
      <input type="hidden" name="password" value={formValues.password} />
      <input type="hidden" name="client_id" value={formValues.client_id} />
      <input type="hidden" name="response_type" value={formValues.response_type} />
      <input type="hidden" name="state" value={formValues.state} />
      <input type="hidden" name="scope" value={formValues.scope} />
      <input type="hidden" name="page_key" value={formValues.page_key} />
      <input type="hidden" name="redirect_uri" value={formValues.redirect_uri} />
      <input type="hidden" name="initiating_url" value={formValues.initiating_url} />
    </form>
  );
}
