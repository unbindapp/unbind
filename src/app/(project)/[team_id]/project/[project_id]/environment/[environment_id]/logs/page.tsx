import TemporaryLogs from "@/app/(project)/[team_id]/project/[project_id]/environment/[environment_id]/logs/_components/temporary-logs";

export default async function Page() {
  return (
    <div className="w-full flex-1 flex flex-col items-center">
      <TemporaryLogs />
    </div>
  );
}
