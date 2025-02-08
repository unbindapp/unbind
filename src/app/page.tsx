import { apiServer } from "@/server/trpc/setup/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const teams = await apiServer.main.getTeams({});
  const firstTeam = teams.teams[0];
  redirect(`${firstTeam.id}`);
  return (
    <div className="w-full flex-1 flex flex-col">
      <main className="w-full flex-1 flex flex-col items-center justify-center pt-12 pb-16 px-5">
        Home
      </main>
    </div>
  );
}
