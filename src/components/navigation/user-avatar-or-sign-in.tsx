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
        <LinkButton size="sm" className="py-1.25" href="/sign-in">
          Sign In
        </LinkButton>
      )}
    </>
  );
}
