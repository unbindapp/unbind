import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import TeamNavbar from "@/components/team/team-navbar";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
};

export default function Layout({ children }: TProps) {
  return (
    <>
      <TeamNavbar />
      {children}
      <NavbarSafeAreaInsetBottom className="sm:hidden" />
    </>
  );
}
