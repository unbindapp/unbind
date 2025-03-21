import TemporaryLogs from "@/components/logs/temporary-logs";
import { useService } from "@/components/service/service-provider";

export default function Logs() {
  const { serviceId } = useService();
  console.log("Logs for serviceId:", serviceId);
  return <TemporaryLogs containerType="sheet" hideServiceByDefault />;
}
