import BrandIcon from "@/components/icons/brand";
import { TServiceGroup } from "@/components/project/service-card-list";
import { cn } from "@/components/ui/utils";

type TProps = {
  groupObject: TServiceGroup;
  className?: string;
  color?: Parameters<typeof BrandIcon>["0"]["color"];
};

export default function ServiceGroupIcon({ groupObject, color = "brand", className }: TProps) {
  return (
    <BrandIcon
      color={color}
      brand={groupObject.group.icon || "service-group"}
      className={cn("size-6", className)}
    />
  );
}
