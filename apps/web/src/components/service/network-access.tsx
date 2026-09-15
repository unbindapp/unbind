import { TCommandItem } from "@/lib/hooks/use-app-form";
import { GlobeIcon, LockIcon } from "lucide-react";

// Shared by the draft state and the Network Access settings section, so a database
// is asked the same question the same way before and after its first deployment
export const publicValue = "public";
export const privateValue = "private";

export const networkAccessItems: TCommandItem[] = [
  { value: publicValue, label: "Public", description: "Reachable from the internet" },
  {
    value: privateValue,
    label: "Private",
    description: "Reachable only by your services",
  },
];

export function networkAccessValue(isPublic: boolean) {
  return isPublic ? publicValue : privateValue;
}

export function networkAccessLabel(isPublic: boolean) {
  return isPublic ? "Public" : "Private";
}

export function NetworkAccessIcon({
  isPublic,
  className,
}: {
  isPublic: boolean;
  className?: string;
}) {
  if (isPublic) return <GlobeIcon className={className} />;
  return <LockIcon className={className} />;
}
