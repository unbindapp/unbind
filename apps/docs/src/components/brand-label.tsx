import BrandIcon from "@/components/icons/brand";
import type { ReactNode } from "react";

export function BrandLabel({ brand, children }: { brand: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <BrandIcon brand={brand} color="brand" className="size-4.5" />
      {children}
    </span>
  );
}
