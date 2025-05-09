import { cn } from "@/components/ui/utils";
import {
  ArchiveIcon,
  BoxIcon,
  KeyIcon,
  SlidersHorizontalIcon,
  TriangleAlertIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { ComponentProps } from "react";

export type TSettingsTabVariant =
  | "general"
  | "environments"
  | "variables"
  | "members"
  | "webhooks"
  | "danger-zone"
  | "storage";

export default function SettingsTabIcon({
  variant,
  className,
  ...rest
}: { variant: TSettingsTabVariant } & ComponentProps<"svg">) {
  if (variant === "environments") {
    return <BoxIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  if (variant === "variables") {
    return <KeyIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  if (variant === "members") {
    return <UsersIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  if (variant === "webhooks") {
    return <WebhookIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  if (variant === "danger-zone") {
    return <TriangleAlertIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  if (variant === "storage") {
    return <ArchiveIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  return <SlidersHorizontalIcon className={cn("size-5 shrink-0", className)} {...rest} />;
}
