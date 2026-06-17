"use client";

import { meQuery } from "@/api/auth";
import UserAvatar from "@/components/navigation/user-avatar";
import { LinkButton } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";

export default function UserAvatarOrSignIn() {
  const { data: me } = useQuery(meQuery);
  const pathname = useLocation({ select: (l) => l.pathname });
  const isSignInPage = pathname === "/sign-in";
  const isWelcomePage = pathname === "/welcome";

  return (
    <>
      {me && <UserAvatar email={me.email ?? ""} />}
      {!me && !isSignInPage && !isWelcomePage && (
        <div className="-mr-0.5 flex items-center justify-end">
          <LinkButton size="sm" to="/sign-in">
            Sign In
          </LinkButton>
        </div>
      )}
    </>
  );
}
