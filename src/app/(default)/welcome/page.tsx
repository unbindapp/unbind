import CreateAccountForm from "@/app/(default)/welcome/_components/create-account-form";
import Logo from "@/components/icons/logo";
import { env } from "@/lib/env";
import { auth } from "@/server/auth/auth";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type TFormValues = {
  username?: string;
  password?: string;
  redirect_uri?: string;
  client_id?: string;
  response_type?: string;
  state?: string;
  scope?: string;
  page_key?: string;
};

type TProps = {
  searchParams: Promise<{
    redirect_pathname?: string;
    redirect_uri?: string;
    client_id?: string;
    response_type?: string;
    state?: string;
    scope?: string;
    error?: string;
  }>;
};

export default async function Page({ searchParams }: TProps) {
  const user = await auth();
  if (user) {
    redirect("/");
  }

  const params = await searchParams;
  const redirectPathname = params.redirect_pathname;

  const cookieStore = await cookies();
  const credentials = cookieStore.get("unbind-credentials");
  const usernameBase64 = credentials?.value.split(":")[0];
  const passwordBase64 = credentials?.value.split(":")[1];

  const username = usernameBase64 ? Buffer.from(usernameBase64, "base64").toString() : undefined;
  const password = passwordBase64 ? Buffer.from(passwordBase64, "base64").toString() : undefined;
  const redirect_uri = params.redirect_uri;
  const client_id = params.client_id;
  const response_type = params.response_type;
  const state = params.state;
  const scope = params.scope;
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
  };

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pt-6 pb-[calc(2rem+5svh)] sm:pt-8 sm:pb-[calc(2rem+12svh)]">
      <div className="flex w-full max-w-sm flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center justify-center gap-1.5">
          <Logo variant="full" className="h-auto w-full max-w-36" />
          <p className="text-muted-foreground w-full px-2 text-center leading-tight">
            Create an account to start
          </p>
        </div>
        <CreateAccountForm
          className="mt-5"
          redirectPathname={redirectPathname}
          formValues={formValues}
          loginUrl={loginUrl}
          error={error}
        />
      </div>
    </div>
  );
}
