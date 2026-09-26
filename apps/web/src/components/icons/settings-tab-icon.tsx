import BrandIcon from "@/components/icons/brand";
import { cn } from "@/components/ui/utils";
import {
  ArchiveIcon,
  ContainerIcon,
  KeyIcon,
  KeySquareIcon,
  BlocksIcon,
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
  | "storage"
  | "api-keys"
  | "connected-apps"
  | "github";

export default function SettingsTabIcon({
  variant,
  className,
  ...rest
}: { variant: TSettingsTabVariant } & ComponentProps<"svg">) {
  if (variant === "environments") {
    return <ContainerIcon className={cn("size-5 shrink-0", className)} {...rest} />;
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

  if (variant === "api-keys") {
    return <KeySquareIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  if (variant === "connected-apps") {
    return <BlocksIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  if (variant === "github") {
    return <BrandIcon brand="github" className={cn("size-5 shrink-0", className)} />;
  }

  if (variant === "storage") {
    return <ArchiveIcon className={cn("size-5 shrink-0", className)} {...rest} />;
  }

  return <SlidersHorizontalIcon className={cn("size-5 shrink-0", className)} {...rest} />;
}
