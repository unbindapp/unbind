import ProjectCard from "@/app/[team_id]/_components/project-card";
import { apiServer } from "@/server/trpc/setup/server";

type Props = {
  params: Promise<{ team_id: string }>;
};

export default async function Page({ params }: Props) {
  const { team_id: teamId } = await params;
  const { projects } = await apiServer.main.getProjects({ teamId });

  return (
    <div className="w-full flex flex-col items-center px-3 md:px-8 pt-4 md:pt-7 pb-16">
      <div className="w-full flex flex-col max-w-5xl">
        <h1 className="w-full px-3 font-bold text-xl">Projects</h1>
        <div className="w-full flex items-center justify-center pt-3">
          <div className="w-full flex flex-wrap">
            {projects && projects.length === 0 && (
              <div className="w-full flex items-center justify-center p-1">
                <p className="w-full text-muted-foreground px-5 text-center rounded-xl border py-16">
                  No projects yet
                </p>
              </div>
            )}
            {projects &&
              projects.length > 0 &&
              projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  className="w-full sm:w-1/2 lg:w-1/3"
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
