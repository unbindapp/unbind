import { ReactNode } from "react";

export default function SettingsSectionWrapper({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-5 pt-2 md:max-w-lg">{children}</div>;
}
