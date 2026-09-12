"use client";

import TabWrapper from "@/components/navigation/tab-wrapper";
import ResourcesSection from "@/components/system/servers/panel/tabs/details/sections/resources-section";
import StatusSection from "@/components/system/servers/panel/tabs/details/sections/status-section";
import SystemSection from "@/components/system/servers/panel/tabs/details/sections/system-section";
import { serverQuery, TServer } from "@/lib/queries/servers";
import { useQuery } from "@tanstack/react-query";

type TProps = {
  server: TServer;
};

export default function Details({ server }: TProps) {
  const { data, error } = useQuery(serverQuery({ name: server.name }));

  return (
    <TabWrapper className="gap-6">
      <StatusSection server={data ?? server} error={error?.message} />
      <ResourcesSection server={data ?? server} />
      <SystemSection server={data ?? server} detail={data} error={error?.message} />
    </TabWrapper>
  );
}
