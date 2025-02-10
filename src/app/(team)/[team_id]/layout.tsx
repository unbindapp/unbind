import TeamNavbar from "@/app/(team)/[team_id]/_components/team-navbar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <>
      <TeamNavbar />
      {children}
    </>
  );
}
