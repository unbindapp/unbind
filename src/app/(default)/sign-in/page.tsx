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
    <div className="w-full flex-1 flex flex-col items-center justify-center pt-6 pb-[calc(2rem+5svh)] sm:pt-8 sm:pb-[calc(2rem+12svh)] px-4">
      <div className="w-full max-w-sm flex flex-col items-center justify-center">
        <div className="w-full flex flex-col items-center justify-center gap-6">
          <div className="w-full flex flex-col items-center justify-center gap-1">
            <Logo variant="full" className="w-36 h-auto" />
            <p className="w-full text-center px-2 text-muted-foreground">
              Sign in to continue
            </p>
          </div>
          <SignInWithOAuthButton providerId="dex" />
        </div>
      </div>
    </div>
  );
}
