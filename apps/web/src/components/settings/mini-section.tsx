import { ReactNode } from "react";

export function MiniSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p className="px-1.5 leading-tight font-medium">{title}</p>
      {children}
    </div>
  );
}
