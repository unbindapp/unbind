import { apiServer } from "@/server/trpc/setup/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const teams = await apiServer.main.getTeams({});
  const firstTeam = teams.teams[0];
  redirect(`${firstTeam.id}`);
  return (
    <div className="flex w-full flex-1 flex-col">
      <main className="flex w-full flex-1 flex-col items-center justify-center px-5 pt-12 pb-16">
        Home
      </main>
    </div>
  );
}
