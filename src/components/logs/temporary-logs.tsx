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
  if (random > 0.4) {
    return `This is a fake log message for testing ${level} ${index}`;
  }
  if (random > 0.2) {
    return `${level} ${index}. This is a fake log message for testing. This is a fake log message for testing. This is a fake log message for testing. This is a fake log message for testing`;
  }
  if (random > 0.1) {
    return `object: {
    message: "${level} ${index} Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.",
    timestamp: ${Date.now()},
    level: "${level}",
}`;
  }
  return `object: {
    message: "${level} ${index} Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.",
    timestamp: ${Date.now()},
    level: "${level}",
    random: "${Math.random()}",
    test: true,
    link: "https://example.com",
}`;
};

const length = 1000;

const initialData: TLogLine[] = Array.from({ length }).map((_, i) => {
  const level = getRandomLevel();
  return {
    level,
    timestamp: Date.now() - (length - i) * 1000,
    message: getRandomLogMessage(i, level),
    deploymentId: "deployment-id",
    serviceId: getRandomServiceId(),
  };
});

type TProps = {
  containerType: "page" | "sheet";
  hideServiceByDefault?: boolean;
};

export default function TemporaryLogs({ containerType, hideServiceByDefault }: TProps) {
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

  return (
    <LogViewer
      logs={logs}
      containerType={containerType}
      hideServiceByDefault={hideServiceByDefault}
    />
  );
}
