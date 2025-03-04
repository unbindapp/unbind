import SettingsTabBar, { TSettingsTab } from "@/components/settings/settings-tab-bar";
import { ReactNode } from "react";

type TProps = {
  children: ReactNode;
  tabs: TSettingsTab[];
  title?: string;
};

export default function SettingsLayout({ title, tabs, children }: TProps) {
  return (
    <div className="flex w-full flex-1 justify-center pt-4 md:px-6 md:pt-5 lg:px-8 lg:pt-7">
      <div className="flex w-full max-w-7xl flex-1 flex-col">
        <h1 className="w-full px-5 text-2xl leading-tight font-bold sm:px-6 md:px-3">
          {title || "Settings"}
        </h1>
        <div className="relative flex w-full flex-1 flex-col pt-2 md:flex-row md:items-stretch md:gap-4 md:pt-3">
          <SettingsTabBar tabs={tabs} />
          <div className="flex min-w-0 flex-1 flex-col px-4 pt-4 pb-12 sm:px-6 sm:pt-5 md:pt-2 md:pr-2 md:pl-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
