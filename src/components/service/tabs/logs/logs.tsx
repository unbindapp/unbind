import TemporaryLogs from "@/components/logs/temporary-logs";
import { TService } from "@/server/trpc/api/main/router";

type TProps = {
  service: TService;
};

export default function Logs({ service }: TProps) {
  console.log("Service from logs tab", service);
  return <TemporaryLogs containerType="sheet" hideServiceByDefault />;
}
