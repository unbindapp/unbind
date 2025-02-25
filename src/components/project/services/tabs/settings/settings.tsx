import { TService } from "@/server/trpc/api/main/router";

type Props = {
  service: TService;
};

export default function Settings({ service }: Props) {
  console.log("Service from settings tab", service);
  return <div></div>;
}
