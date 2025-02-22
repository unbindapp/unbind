"use client";

import { TLogLine } from "@/components/logs/log-line";
import Logs from "@/components/logs/logs";
import { useState } from "react";
import { useInterval } from "usehooks-ts";

const getRandomLevel = () =>
  Math.random() > 0.06 ? "info" : Math.random() > 0.03 ? "error" : "warn";

const getRandomServiceId = () => `service-${Math.floor(Math.random() * 6)}`;

const initialData: TLogLine[] = Array.from({ length: 200 }).map((_, i) => {
  const level = getRandomLevel();
  return {
    level,
    timestamp: Date.now() - i * 1000,
    message: `This is a fake log message for testing ${level} ${i}`,
    deploymentId: "deployment-id",
    serviceId: getRandomServiceId(),
  };
});

type Props = {
  containerType: "page" | "sheet";
};

export default function TemporaryLogs({ containerType }: Props) {
  const [logs, setLogs] = useState<TLogLine[]>(initialData);

  useInterval(() => {
    setLogs((prevLogs) => {
      const level = getRandomLevel();
      const newLog: TLogLine = {
        level,
        timestamp: Date.now(),
        message: `This is a fake log message for testing ${level} ${prevLogs.length}`,
        deploymentId: "deployment-id",
        serviceId: getRandomServiceId(),
      };
      return [...prevLogs, newLog];
    });
  }, 1000);

  return <Logs logs={logs} containerType={containerType} />;
}
