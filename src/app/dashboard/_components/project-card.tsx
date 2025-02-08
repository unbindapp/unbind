import { cn } from "@/components/ui/utils";
import { TProject } from "@/server/trpc/api/main/router";

type Props = {
  project: TProject;
  className?: string;
};

export default function ProjectCard({ project, className }: Props) {
  return (
    <div className={cn("w-full flex flex-col p-1", className)}>
      <div className="w-full flex flex-col gap-20 border rounded-xl px-5 py-3.5">
        <h3 className="w-full font-bold leading-tight whitespace-nowrap overflow-hidden overflow-ellipsis">
          {project.title}
        </h3>
        <div className="w-full flex items-center justify-between text-muted-foreground">
          <p className="shrink min-w-0 overflow-hidden overflow-ellipsis whitespace-nowrap">
            {project.services.length} services
          </p>
          <div className="min-w-0 shrink flex items-center">
            {project.services.map((s) => (
              <div key={s.id}>{s.serviceType}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
