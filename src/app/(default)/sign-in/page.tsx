import SignInWithOAuthButton from "@/components/auth/sign-in-with-oauth-button";
import Logo from "@/components/icons/logo";
import { auth } from "@/server/auth/auth";
import { redirect } from "next/navigation";

export default async function Page() {
  const user = await auth();
  if (user) {
    redirect("/");
  }

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pt-6 pb-[calc(2rem+5svh)] sm:pt-8 sm:pb-[calc(2rem+12svh)]">
      <div className="flex w-full max-w-sm flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center justify-center gap-6">
          <div className="flex w-full flex-col items-center justify-center gap-1">
            <Logo variant="full" className="h-auto w-36" />
            <p className="text-muted-foreground w-full px-2 text-center">Sign in to continue</p>
          </div>
          <SignInWithOAuthButton providerId="dex" />
        </div>
      </div>
    </div>
  );
}
