import ServiceLogoIcon from "@/components/icons/service-logo-icon";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";

type TProps = {
  service: TServiceShallow;
  className?: string;
  color?: Parameters<typeof ServiceLogoIcon>["0"]["color"];
};

export default function ServiceIcon({ service, color = "brand", className }: TProps) {
  return (
    <ServiceLogoIcon
      color={color}
      variant={
        service.config.framework ||
        service.config.provider ||
        (service.git_repository && "github") ||
        (service.config.image && "docker")
      }
      className={cn("size-6", className)}
    />
  );
}
