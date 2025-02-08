import ProjectCard from "@/app/dashboard/_components/project-card";
import { apiServer } from "@/server/trpc/setup/server";

type Props = {};

export default async function Page({}: Props) {
  const { projects } = await apiServer.main.getProjects({});
  return (
    <div className="w-full flex flex-col items-center px-3 md:px-8">
      <div className="w-full flex flex-col max-w-5xl">
        <h1 className="w-full px-3 font-bold text-xl">Dashboard</h1>
        <div className="w-full flex items-center justify-center pt-3">
          <div className="w-full flex flex-wrap">
            {projects.map((p) => (
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
