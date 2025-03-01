"use client";

import { useTheme } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import { useIsMounted } from "usehooks-ts";

export default function TopLoader() {
  const { resolvedTheme } = useTheme();
  const isMounted = useIsMounted();
  return (
    <NextTopLoader
      zIndex={9999}
      showSpinner={false}
      color="var(--top-loader)"
      shadow={false}
      height={isMounted() && resolvedTheme === "light" ? 3 : 2}
    />
  );
}
