import ServiceCard from "@/components/project/service-card";
import { TServiceGroup } from "@/components/project/service-card-list";
import { cn } from "@/components/ui/utils";

type TProps = {
  groupObject: TServiceGroup;
  teamId: string;
  projectId: string;
  environmentId: string;
  className?: string;
};

export default function ServiceGroupCard({
  groupObject,
  teamId,
  projectId,
  environmentId,
  className,
}: TProps) {
  return (
    <li className={cn("flex w-full p-1", className)}>
      <div className="flex w-full flex-col rounded-xl border border-dashed">
        <div className="flex w-full">
          <p className="min-w-0 shrink truncate px-4 pt-2.5 pb-1.5 leading-tight font-semibold">
            {groupObject.group.name}
          </p>
        </div>
        <ol className="flex w-full flex-wrap p-1">
          {groupObject.services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
              className="w-full sm:w-1/2 lg:w-1/3"
              classNameCard="rounded-lg"
            />
          ))}
        </ol>
      </div>
    </li>
  );
}
