"use client";

import UserAvatar from "@/components/navigation/user-avatar";
import { LinkButton } from "@/components/ui/button";
import { Session } from "next-auth";
import { usePathname } from "next/navigation";

type Props = {
  session: Session | null;
};

export default function UserAvatarOrSignIn({ session }: Props) {
  const pathname = usePathname();
  const isSignInPage = pathname === "/sign-in";

  return (
    <>
      {session && <UserAvatar email={session.user.email} />}
      {!session && !isSignInPage && (
        <div className="flex items-center justify-end -mr-0.5">
          <LinkButton size="sm" className="py-1.25" href="/sign-in">
            Sign In
          </LinkButton>
        </div>
      )}
    </>
  );
}
