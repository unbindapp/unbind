import Sidebar from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/settings/_components/sidebar";
import PageWrapper from "@/components/page-wrapper";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <PageWrapper>
      <div className="w-full flex flex-col md:flex-row max-w-7xl gap-4 px-1 relative">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">{children}</div>
      </div>
    </PageWrapper>
  );
}
