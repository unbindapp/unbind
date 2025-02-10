import ProjectNavbar from "@/app/(project)/[team_id]/project/[project_id]/_components/project-navbar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <>
      <ProjectNavbar />
      {children}
    </>
  );
}
