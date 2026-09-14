"use client";

import Logo from "@/components/icons/logo";
import { LinkButton } from "@/components/ui/button";
import { useMatchRoute } from "@tanstack/react-router";

// Inside a project the logo steps up to the team; everywhere else it goes home.
export default function LogoLink() {
  const matchRoute = useMatchRoute();
  const projectMatch = matchRoute({ to: "/$team_id/project/$project_id", fuzzy: true });

  return (
    <div className="flex items-stretch justify-center self-stretch">
      <div className="flex items-center justify-center">
        <LinkButton
          size="icon"
          className="group/button h-full min-h-11.5 w-11.5 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent has-hover:hover:bg-transparent"
          variant="ghost"
          {...(projectMatch
            ? { to: "/$team_id", params: { team_id: projectMatch.team_id } }
            : { to: "/" })}
        >
          <div className="pointer-events-none absolute top-0 left-0 h-full w-full p-1">
            <div className="has-hover:group-hover/button:bg-border group-active/button:bg-border group-focus-visible/button:ring-primary/8-10 h-full w-full rounded-lg group-focus-visible/button:ring-1" />
          </div>
          <Logo className="relative size-6" />
        </LinkButton>
      </div>
    </div>
  );
}
