import { isDomain } from "@/lib/helpers/is-domain";

export function validateDomain({ value, isPublic }: { value: string; isPublic: boolean }) {
  if (!isPublic) return undefined;
  if (!value) return { message: "Domain is required." };
  const isValidDomain = isDomain(value);
  if (!isValidDomain) {
    return { message: "Invalid domain." };
  }
  return undefined;
}
