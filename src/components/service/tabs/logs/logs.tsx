import { useService } from "@/components/service/service-provider";

export default function Logs() {
  const { serviceId } = useService();
  console.log("Logs for serviceId:", serviceId);
  return null;
}
