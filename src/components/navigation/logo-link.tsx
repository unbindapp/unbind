"use client";

import Logo from "@/components/icons/logo";
import { LinkButton } from "@/components/ui/button";
import { usePathname } from "next/navigation";

export default function LogoLink() {
  const pathname = usePathname();
  const pathnameArr = pathname.split("/");
  const teamIdFromPathname =
    pathnameArr.length > 1 ? pathnameArr[1] : undefined;
  const projectIdFromPathname =
    pathnameArr.length > 3 ? pathnameArr[3] : undefined;

  return (
    <div className="self-stretch flex items-center justify-center">
      <div className="h-12 sm:h-11.5 flex items-center justify-center">
        <LinkButton
          size="icon"
          className="w-12 h-12 sm:w-11.5 sm:h-11.5 rounded-lg has-hover:hover:bg-transparent active:bg-transparent group/button 
          focus-visible:ring-0 focus-visible:ring-offset-0"
          variant="ghost"
          href={projectIdFromPathname ? `/${teamIdFromPathname}` : "/"}
        >
          <div className="pointer-events-none w-full h-full absolute left-0 top-0 p-1">
            <div
              className="w-full h-full rounded-lg has-hover:group-hover/button:bg-border group-active/button:bg-border
              group-focus-visible/button:ring-1 group-focus-visible/button:ring-primary/50"
            />
          </div>
          <Logo className="size-6 relative" />
        </LinkButton>
      </div>
    </div>
  );
}
