import ErrorLine from "@/components/error-line";
import { useSystem } from "@/components/system/system-provider";
import { useEffect, useState } from "react";
import { z } from "zod";

const DomainSchema = z
  .string()
  .nonempty()
  .refine((val) => !val.includes(" "), "Domain can't contain spaces")
  .refine((val) => val.includes("."), "Domain must contain a dot");

export function DomainCard({ domain }: { domain: string }) {
  const { data, isPending, error } = useSystem();
  const [isValidDomain, setIsValidDomain] = useState(false);

  useEffect(() => {
    const { success } = DomainSchema.safeParse(domain);
    setIsValidDomain(success);
  }, [domain]);

  if (!isValidDomain) return null;

  return (
    <div
      data-pending={!data && isPending ? true : undefined}
      data-error={!data && !isPending && error ? true : undefined}
      className="group/card flex w-full flex-col items-start justify-start gap-1 border text-sm select-text"
    >
      <div className="flex w-full items-start justify-start gap-6 px-3 pt-2 pb-2.5">
        <div className="flex flex-col gap-0.5">
          <p className="text-muted-foreground leading-tight">Type</p>
          <p className="leading-tight font-medium">A</p>
        </div>
        <div className="flex min-w-0 shrink flex-col gap-0.5">
          <p className="text-muted-foreground leading-tight">Name</p>
          <p className="leading-tight font-medium">{domain}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-muted-foreground leading-tight">Content</p>
          <p className="group-data-error/card:text-destructive group-data-pending/card:animate-skeleton group-data-pending/card:bg-foreground leading-tight font-medium group-data-pending/card:rounded-md group-data-pending/card:text-transparent">
            {data
              ? data?.data.external_ipv4 || data?.data.external_ipv6
              : error
                ? "Error"
                : "Loading..."}
          </p>
        </div>
      </div>
      {error && (
        <div className="w-full px-1.5 pb-1.5">
          <ErrorLine message={error.message} className="rounded-lg" />
        </div>
      )}
    </div>
  );
}
