import { getSignInLikePageParams } from "@/components/auth/helpers";
import { TSignInLikePageProps } from "@/components/auth/types";
import CreateAccountForm from "@/components/auth/create-account-form";
import Logo from "@/components/icons/logo";
import { auth } from "@/server/auth/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Page({ searchParams }: TSignInLikePageProps) {
  const user = await auth();
  if (user) {
    redirect("/");
  }

  const cookiesStore = await cookies();
  const params = await searchParams;

  const { formValues, redirectPathname, loginUrl, error } = await getSignInLikePageParams({
    cookies: cookiesStore,
    searchParams: params,
  });

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
