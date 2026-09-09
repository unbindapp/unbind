import { volumeNameMaxLength } from "./limits.ts";

const volumeNameSuffix = "-volume";
const volumeNameSlugMaxLength = volumeNameMaxLength - volumeNameSuffix.length;

export function getDefaultVolumeName(serviceName: string): string {
  const slug = serviceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, volumeNameSlugMaxLength)
    .replace(/-+$/, "");
  return `${slug || "service"}${volumeNameSuffix}`;
}
