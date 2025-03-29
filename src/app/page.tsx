import { apiServer } from "@/server/trpc/setup/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const res = await apiServer.teams.list();
  const firstTeam = res.teams[0];
  const redirectTo = `/${firstTeam.id}`;
  console.log("Redirecting to: ", redirectTo);
  redirect(redirectTo);
}
