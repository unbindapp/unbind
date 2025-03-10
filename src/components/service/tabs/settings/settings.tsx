import { TService } from "@/server/trpc/api/main/router";

type TProps = {
  service: TService;
};

export default function Settings({ service }: TProps) {
  console.log("Service from settings tab", service);
  return <div></div>;
}
