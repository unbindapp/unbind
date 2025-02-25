import TemporaryLogs from "@/components/logs/temporary-logs";

export default async function Page() {
  return (
    <div className="w-full flex-1 flex flex-col items-center">
      <TemporaryLogs containerType="page" />
    </div>
  );
}
