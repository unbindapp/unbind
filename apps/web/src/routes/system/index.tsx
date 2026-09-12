import { createFileRoute } from "@tanstack/react-router";

import PageWrapper from "@/components/page-wrapper";
import ServerCardList from "@/components/system/servers/server-card-list";

export const Route = createFileRoute("/system/")({
  component: SystemServersPage,
});

function SystemServersPage() {
  return (
    <PageWrapper>
      <div className="flex w-full max-w-7xl flex-col">
        <h1 className="min-w-0 px-3 text-2xl leading-tight font-semibold">Servers</h1>
        <ServerCardList className="pt-3" />
      </div>
    </PageWrapper>
  );
}
