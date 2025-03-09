"use client";

import UserAvatar from "@/components/navigation/user-avatar";
import { LinkButton } from "@/components/ui/button";
import { Session } from "next-auth";
import { usePathname } from "next/navigation";

type TProps = {
  session: Session | null;
};

export default function UserAvatarOrSignIn({ session }: TProps) {
  const pathname = usePathname();
  const isSignInPage = pathname === "/sign-in";

  return (
    <>
      {session && <UserAvatar email={session.user.email} />}
      {!session && !isSignInPage && (
        <div className="-mr-0.5 flex items-center justify-end">
          <LinkButton size="sm" href="/sign-in">
            Sign In
          </LinkButton>
        </div>
      )}
    </>
  );
}
