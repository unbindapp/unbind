import { useRouterState } from "@tanstack/react-router";

// Minimal navigation progress bar driven by the router's pending state
// (replaces nextjs-toploader).
export default function TopLoader() {
  const isLoading = useRouterState({ select: (s) => s.status === "pending" });

  return (
    <div
      aria-hidden
      className="bg-top-loader pointer-events-none fixed top-0 left-0 z-9999 h-0.5 transition-all duration-300 ease-out"
      style={{
        width: isLoading ? "90%" : "100%",
        opacity: isLoading ? 1 : 0,
      }}
    />
  );
}
