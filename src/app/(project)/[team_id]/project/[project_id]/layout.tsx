import NavbarSafeAreaInset from "@/components/navigation/navbar-safe-area-inset";
import ProjectNavbar from "@/components/project/project-navbar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <>
      <ProjectNavbar />
      {children}
      <NavbarSafeAreaInset className="sm:hidden" classNameInner="h-24" />
    </>
  );
}
