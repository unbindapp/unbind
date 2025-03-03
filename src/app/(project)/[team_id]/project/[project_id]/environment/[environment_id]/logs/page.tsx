import TemporaryLogs from "@/components/logs/temporary-logs";

export default async function Page() {
  return (
    <div className="flex w-full flex-1 flex-col items-center">
      <TemporaryLogs containerType="page" />
    </div>
  );
}
