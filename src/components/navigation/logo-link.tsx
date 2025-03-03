"use client";

import Logo from "@/components/icons/logo";
import { LinkButton } from "@/components/ui/button";
import { usePathname } from "next/navigation";

export default function LogoLink() {
  const pathname = usePathname();
  const pathnameArr = pathname.split("/");
  const teamIdFromPathname = pathnameArr.length > 1 ? pathnameArr[1] : undefined;
  const projectIdFromPathname = pathnameArr.length > 3 ? pathnameArr[3] : undefined;

  return (
    <div className="flex items-center justify-center self-stretch">
      <div className="flex h-12 items-center justify-center sm:h-11.5">
        <LinkButton
          size="icon"
          className="group/button h-12 w-12 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-transparent has-hover:hover:bg-transparent sm:h-11.5 sm:w-11.5"
          variant="ghost"
          href={projectIdFromPathname ? `/${teamIdFromPathname}` : "/"}
        >
          <div className="pointer-events-none absolute top-0 left-0 h-full w-full p-1">
            <div className="has-hover:group-hover/button:bg-border group-active/button:bg-border group-focus-visible/button:ring-primary/50 h-full w-full rounded-lg group-focus-visible/button:ring-1" />
          </div>
          <Logo className="relative size-6" />
        </LinkButton>
      </div>
    </div>
  );
}
