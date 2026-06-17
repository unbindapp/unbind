import { ReactNode } from "react";

import Logo from "@/components/icons/logo";

export function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-svh w-full flex-1 flex-col items-center justify-center px-4 pt-6 pb-[calc(2rem+5svh)] sm:pt-8 sm:pb-[calc(2rem+12svh)]">
      <div className="flex w-full max-w-sm flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center justify-center gap-1.5">
          <Logo variant="full" className="h-auto w-full max-w-36" />
          <p className="text-muted-foreground w-full px-2 text-center leading-tight">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
