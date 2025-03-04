import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import ProjectNavbar from "@/components/project/project-navbar";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
};

export default function Layout({ children }: TProps) {
  return (
    <>
      <ProjectNavbar />
      {children}
      <NavbarSafeAreaInsetBottom className="sm:hidden" />
    </>
  );
}
