import { TTemplateInput } from "@/components/templates/template-draft-store";
import { formatGB } from "@/lib/helpers/format-gb";
import { isDomain } from "@/lib/helpers/is-domain";

export function templateInputValidator({
  value,
  type,
  maxStorageGb,
  minStorageGb,
}: {
  value: string;
  type: TTemplateInput["type"];
  maxStorageGb: number;
  minStorageGb: number;
}) {
  if (type === "host") {
    if (typeof value !== "string") {
      return { message: "Domain needs to be a string." };
    }
    if (value.length < 1) {
      return { message: "Domain is required." };
    }
    if (!isDomain(value)) {
      return { message: "Domain is not valid." };
    }
  }
  if (type === "database-size" || type === "volume-size") {
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
      return { message: "Size needs to be a number." };
    }
    if (parsedValue < minStorageGb) {
      return { message: `Size must be more than ${formatGB(minStorageGb)}.` };
    }
    if (parsedValue > maxStorageGb) {
      return { message: `Size must be less than ${formatGB(maxStorageGb)}.` };
    }
  }
  return undefined;
}
