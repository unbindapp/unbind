import ServiceCard from "@/components/project/service-card";
import { TServiceGroup } from "@/components/project/service-card-list";
import ServiceGroupIcon from "@/components/service/service-group-icon";
import { cn } from "@/components/ui/utils";

type TProps = {
  groupObject: TServiceGroup;
  teamId: string;
  projectId: string;
  environmentId: string;
  className?: string;
  classNameServiceCard?: string;
} & React.HTMLProps<HTMLLIElement>;

const cardStyle: React.HTMLProps<HTMLLIElement>["style"] = {
  backgroundColor: "transparent",
  backgroundImage:
    "radial-gradient(color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px), radial-gradient(color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px)",
  backgroundSize: "10px 10px",
  backgroundPosition: "0px 0px, 5px 5px",
};

export default function ServiceGroupCard({
  groupObject,
  teamId,
  projectId,
  environmentId,
  className,
  classNameServiceCard,
  ...rest
}: TProps) {
  return (
    <li className={cn("flex w-full p-1", className)} {...rest}>
      <div
        style={cardStyle}
        className="relative flex w-full flex-col overflow-hidden rounded-xl border"
      >
        <div className="relative flex w-full items-center gap-2 px-4 pt-2.5 pb-1.5">
          <ServiceGroupIcon groupObject={groupObject} className="-ml-1 size-6" />
          <p className="min-w-0 shrink truncate leading-tight font-semibold">
            {groupObject.group.name}
          </p>
        </div>
        <ol className="relative flex w-full flex-wrap p-1">
          {groupObject.services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              teamId={teamId}
              projectId={projectId}
              environmentId={environmentId}
              className={classNameServiceCard}
              classNameCard="rounded-lg min-h-32"
            />
          ))}
        </ol>
      </div>
    </li>
  );
}
