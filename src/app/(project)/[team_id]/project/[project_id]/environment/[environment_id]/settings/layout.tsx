import Sidebar from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/settings/_components/sidebar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <div className="w-full flex-1 flex justify-center pt-4 md:px-6 md:pt-5 lg:px-8 lg:pt-7 pb-16">
      <div className="w-full flex flex-col max-w-7xl">
        <h1 className="w-full font-bold text-2xl leading-tight px-5 sm:px-6 md:px-3">
          Settings
        </h1>
        <div className="w-full flex flex-col md:flex-row md:gap-4 relative pt-2 md:pt-3">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col pt-3 sm:pt-4 md:pt-2 px-4 sm:px-6 md:px-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
