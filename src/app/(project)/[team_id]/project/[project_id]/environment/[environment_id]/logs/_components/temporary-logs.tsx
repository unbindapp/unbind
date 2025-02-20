"use client";

import Logs, { TLogLine } from "@/components/logs";
import { useState } from "react";
import { useInterval } from "usehooks-ts";

const getRandomLevel = () =>
  Math.random() > 0.06 ? "info" : Math.random() > 0.03 ? "error" : "warn";

export default function TemporaryLogs() {
  const [logs, setLogs] = useState<TLogLine[]>(
    Array.from({ length: 200 }).map((_, i) => {
      const level = getRandomLevel();
      return {
        level,
        timestamp: Date.now(),
        message: `This is a fake log message for testing ${level} ${i}`,
        deploymentId: "deployment-id",
        serviceId: "service-id",
      };
    })
  );
  useInterval(() => {
    setLogs((prevLogs) => {
      const level = getRandomLevel();
      const newLog: TLogLine = {
        level,
        timestamp: Date.now(),
        message: `This is a fake log message for testing ${level} ${prevLogs.length}`,
        deploymentId: "deployment-id",
        serviceId: "service-id",
      };
      return [...prevLogs, newLog];
    });
  }, 1000);

  return <Logs logs={logs} />;
}
