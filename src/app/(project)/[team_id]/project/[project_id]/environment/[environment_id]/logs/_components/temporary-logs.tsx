"use client";

import { TLogLine } from "@/components/logs/log-line";
import LogViewer from "@/components/logs/log-viewer";
import { useState } from "react";
import { useInterval } from "usehooks-ts";

const getRandomLevel = () => {
  const random = Math.random();
  return random > 0.1 ? "info" : random > 0.05 ? "error" : "warn";
};

const getRandomServiceId = () => `service-${Math.floor(Math.random() * 6)}`;

const getRandomLogMessage = (index: number, level: TLogLine["level"]) => {
  const random = Math.random();
  if (random < 0.8) {
    return `This is a fake log message for testing ${level} ${index}`;
  }
  return `object: {
    message: "${level} ${index} Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.",
    timestamp: ${Date.now()},
    level: "${level}"
}`;
};

const initialData: TLogLine[] = Array.from({ length: 200 }).map((_, i) => {
  const level = getRandomLevel();
  return {
    level,
    timestamp: Date.now() - i * 1000,
    message: getRandomLogMessage(i, level),
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
        message: getRandomLogMessage(prevLogs.length, level),
        deploymentId: "deployment-id",
        serviceId: getRandomServiceId(),
      };
      return [...prevLogs, newLog];
    });
  }, 1000);

  return <LogViewer logs={logs} containerType={containerType} />;
}
