import Sidebar from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/settings/_components/sidebar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <div className="w-full flex-1 flex justify-center px-2 sm:px-3 md:px-8 pt-4 md:pt-7 pb-16">
      <div className="w-full flex flex-col max-w-7xl">
        <h1 className="w-full font-bold text-2xl leading-tight px-3">
          Settings
        </h1>
        <div className="w-full flex flex-col md:flex-row gap-4 relative pt-3">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col pt-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}
