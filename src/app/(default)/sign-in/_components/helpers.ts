import { TFormValues, TSignInLikePageProps } from "@/app/(default)/sign-in/_components/types";
import { env } from "@/lib/env";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";

export function errorCodeToText(error: string) {
  switch (error) {
    case "NO_REFERER":
      return "No referer header found.";
    case "SETUP_ALREADY_COMPLETED":
      return "Setup is already completed.";
    case "USER_CREATION_FAILED":
      return "Failed to create user.";
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

export async function getSignInLikePageParams(searchParams: TSignInLikePageProps["searchParams"]) {
  const params = await searchParams;

  const cookieStore = await cookies();
  const credentials = cookieStore.get("unbind-credentials");
  const usernameBase64 = credentials?.value.split(":")[0];
  const passwordBase64 = credentials?.value.split(":")[1];

  const redirectPathname = params.redirect_pathname;
  const username = usernameBase64 ? Buffer.from(usernameBase64, "base64").toString() : undefined;
  const password = passwordBase64 ? Buffer.from(passwordBase64, "base64").toString() : undefined;
  const redirect_uri = params.redirect_uri;
  const client_id = params.client_id;
  const response_type = params.response_type;
  const state = params.state;
  const scope = params.scope;
  const initiating_url = params.initiating_url;
  const page_key = randomUUID();
  const error = params.error;

  const loginUrl = `${env.UNBIND_API_AUTH_EXTERNAL_URL}/login`;

  const formValues: TFormValues = {
    username,
    password,
    redirect_uri,
    client_id,
    response_type,
    state,
    scope,
    page_key,
    initiating_url,
  };

  return {
    redirectPathname,
    formValues,
    loginUrl,
    error,
  };
}
