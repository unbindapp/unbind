"use client";

import ErrorLine from "@/components/error-line";
import ServerCard from "@/components/system/servers/server-card";
import { cn } from "@/components/ui/utils";
import { serversListQuery } from "@/lib/queries/servers";
import { useQuery } from "@tanstack/react-query";

type TProps = {
  className?: string;
};

const cardClassName = "w-full sm:w-1/2 lg:w-1/3";

export default function ServerCardList({ className }: TProps) {
  const { data, isPending, error } = useQuery(serversListQuery());

  if (!data && isPending) {
    return (
      <ul className={cn("flex w-full flex-wrap", className)}>
        {Array.from({ length: 3 }).map((_, index) => (
          <ServerCard key={index} isPlaceholder className={cardClassName} />
        ))}
      </ul>
    );
  }

  if (!data) {
    return (
      <div className={cn("w-full p-1", className)}>
        <ErrorLine withIcon message={error?.message} />
      </div>
    );
  }

  if (data.data.length === 0) {
    return (
      <div className={cn("w-full p-1", className)}>
        <p className="text-muted-foreground w-full rounded-xl border px-5 py-8 text-center font-medium">
          No servers found.
        </p>
      </div>
    );
  }

  return (
    <ul className={cn("flex w-full flex-wrap", className)}>
      {data.data.map((server) => (
        <ServerCard key={server.name} server={server} className={cardClassName} />
      ))}
    </ul>
  );
}
