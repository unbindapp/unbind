import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const SHOW_AFTER_MS = 200;

export function TopLoader() {
  const isPending = useRouterState({ select: (s) => s.status === "pending" });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isPending]);

  return (
    <div
      aria-hidden
      className="bg-top-loader pointer-events-none fixed top-0 left-0 z-9999 h-0.5 transition-all duration-300 ease-out"
      style={{
        width: visible ? "90%" : "100%",
        opacity: visible ? 1 : 0,
      }}
    />
  );
}
