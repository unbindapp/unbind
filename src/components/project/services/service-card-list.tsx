"use client";

import ServiceCard from "@/components/project/services/service-card";
import ServiceIcon from "@/components/icons/service";
import { groupByServiceGroup } from "@/lib/helpers";
import { api } from "@/server/trpc/setup/client";

type Props = {
  projectId: string;
  environmentId: string;
};

export default function ServiceCardList({ projectId, environmentId }: Props) {
  const [, { data }] = api.main.getServices.useSuspenseQuery({
    projectId,
    environmentId,
  });
  const services = data?.services;
  const groupedServices = groupByServiceGroup(services);

  return (
    <ol className="w-full flex flex-wrap">
      {groupedServices && groupedServices.length === 0 && (
        <li className="w-full flex items-center justify-center p-1">
          <p className="w-full text-muted-foreground px-5 text-center rounded-xl border py-16">
            No services yet.
          </p>
        </li>
      )}
      {groupedServices &&
        groupedServices.length > 0 &&
        groupedServices.map((g) => {
          if (g.group) {
            return (
              <div key={g.group.id} className="w-full px-1 pb-1 pt-1">
                <div
                  style={{
                    backgroundImage: `repeating-linear-gradient(
                      135deg,
                      hsl(var(--border)/0.3),
                      hsl(var(--border)/0.3) 2px,
                      transparent 2px,
                      transparent 6px
                    )`,
                  }}
                  className="w-full flex flex-col rounded-xl border p-1"
                >
                  <div className="w-full px-3 pt-2 pb-2.5 leading-tight font-semibold flex items-center gap-2">
                    <ServiceIcon variant={g.group.type} className="size-6" />
                    <p className="shrink min-w-0 overflow-hidden overflow-ellipsis whitespace-nowrap">
                      {g.group.title}
                    </p>
                  </div>
                  <div className="w-full flex justify-start items-center flex-wrap">
                    {g.services.map((s) => (
                      <ServiceCard
                        key={s.id}
                        service={s}
                        className="w-full sm:w-1/2 lg:w-1/3"
                        classNameCard="rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          return g.services.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              className="w-full sm:w-1/2 lg:w-1/3"
            />
          ));
        })}
    </ol>
  );
}
