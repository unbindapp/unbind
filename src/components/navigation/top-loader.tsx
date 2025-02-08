"use client";

import { useTheme } from "next-themes";
import NextTopLoader from "nextjs-toploader";

export default function TopLoader() {
  const { resolvedTheme } = useTheme();
  return (
    <NextTopLoader
      zIndex={9999}
      showSpinner={false}
      color="hsl(var(--top-loader))"
      shadow={false}
      height={resolvedTheme === "light" ? 3 : 2}
    />
  );
}
