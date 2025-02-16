import NavbarSafeAreaInset from "@/components/navigation/navbar-safe-area-inset";
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
      <NavbarSafeAreaInset className="sm:hidden" />
    </>
  );
}
