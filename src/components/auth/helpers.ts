import { TFormValues, TSignInLikePageProps } from "@/components/auth/types";
import { env } from "@/lib/env";
import { randomUUID } from "crypto";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export function errorCodeToText(error: string) {
  switch (error) {
    case "NO_REFERER":
      return "No referer header found.";
    case "INITIAL_USER_ALREADY_EXISTS":
      return "Initial user already exists.";
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

export async function getSignInLikePageParams({
  cookies,
  searchParams,
}: {
  cookies: ReadonlyRequestCookies;
  searchParams: Awaited<TSignInLikePageProps["searchParams"]>;
}) {
  const credentials = cookies.get("unbind-credentials");
  const usernameBase64 = credentials?.value.split(":")[0];
  const passwordBase64 = credentials?.value.split(":")[1];

  const redirectPathname = searchParams.redirect_pathname;
  const username = usernameBase64 ? Buffer.from(usernameBase64, "base64").toString() : undefined;
  const password = passwordBase64 ? Buffer.from(passwordBase64, "base64").toString() : undefined;
  const redirect_uri = searchParams.redirect_uri;
  const client_id = searchParams.client_id;
  const response_type = searchParams.response_type;
  const state = searchParams.state;
  const scope = searchParams.scope;
  const initiating_url = searchParams.initiating_url;
  const page_key = randomUUID();
  const error = searchParams.error;

  const loginUrl = `${env.UNBIND_API_EXTERNAL_URL}/auth/login`;

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
