import Sidebar from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/settings/_components/sidebar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <div className="w-full flex-1 flex justify-center pt-4 md:px-6 md:pt-5 lg:px-8 lg:pt-7">
      <div className="w-full flex-1 flex flex-col max-w-7xl">
        <h1 className="w-full font-bold text-2xl leading-tight px-5 sm:px-6 md:px-3">
          Settings
        </h1>
        <div className="w-full flex-1 flex flex-col md:flex-row md:items-stretch md:gap-4 relative mt-2 md:mt-3">
          <Sidebar className="md:max-h-[calc(100svh-6rem)] lg:max-h-[calc(100svh-3rem-1px)]" />
          <div className="flex-1 min-w-0 flex flex-col pt-3 sm:pt-4 md:pt-2 px-4 sm:px-6 md:px-0 pb-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
