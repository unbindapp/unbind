import BrandIcon from "@/components/icons/brand";
import { cn } from "@/components/ui/utils";
import { TServiceShallow } from "@/server/trpc/api/services/types";

type TProps = {
  service: TServiceShallow;
  className?: string;
  color?: Parameters<typeof BrandIcon>["0"]["color"];
};

export default function ServiceIcon({ service, color = "brand", className }: TProps) {
  return (
    <BrandIcon
      color={color}
      brand={
        service.config.framework ||
        service.config.provider ||
        (service.git_repository && "github") ||
        (service.config.image && "docker")
      }
      className={cn("size-6", className)}
    />
  );
}
