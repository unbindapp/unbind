"use client";

import ErrorPageTemplate from "@/components/navigation/error-page-template";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPageTemplate error={error} reset={reset} />;
}
