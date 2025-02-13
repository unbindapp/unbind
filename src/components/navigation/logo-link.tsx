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
    <div className="py-1 pr-1.25 flex items-center">
      <LinkButton
        size="icon"
        className="size-9 rounded-lg"
        variant="ghost"
        href={projectIdFromPathname ? `/${teamIdFromPathname}` : "/"}
      >
        <Logo className="size-6" />
      </LinkButton>
    </div>
  );
}
