import NavbarSafeAreaInsetBottom from "@/components/navigation/navbar-safe-area-inset-bottom";
import TeamNavbar from "@/components/team/team-navbar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <>
      <TeamNavbar />
      {children}
      <NavbarSafeAreaInsetBottom className="sm:hidden" />
    </>
  );
}
