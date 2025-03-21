import { useService } from "@/components/service/service-provider";

export default function Settings() {
  const { serviceId } = useService();
  console.log("Service for serviceId: ", serviceId);
  return <div></div>;
}
