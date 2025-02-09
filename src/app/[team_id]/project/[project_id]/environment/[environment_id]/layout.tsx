import TabBar from "@/app/[team_id]/project/[project_id]/environment/[environment_id]/_components/tab-bar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <>
      <TabBar />
      {children}
    </>
  );
}
