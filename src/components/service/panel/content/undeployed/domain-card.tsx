import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useSystem } from "@/components/system/system-provider";
import { cn } from "@/components/ui/utils";
import { defaultDebounceMs } from "@/lib/constants";
import { api } from "@/server/trpc/setup/client";
import { CheckCircleIcon, HourglassIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";
import { z } from "zod";

const DomainSchema = z
  .string()
  .nonempty()
  .refine((val) => !val.includes(" "), "Domain can't contain spaces")
  .refine((val) => val.includes("."), "Domain must contain a dot");

export function DomainCard({ domain, className }: { domain: string; className?: string }) {
  const { data, isPending, error } = useSystem();
  const [isValidDebouncedDomain, setIsValidDebouncedDomain] = useState(false);
  const [isValidDomain, setIsValidDomain] = useState(false);

  const [debouncedDomain] = useDebounce(domain, defaultDebounceMs);

  const isValid = isValidDebouncedDomain && isValidDomain;

  const { data: dnsCheckData } = api.system.dnsCheck.useQuery(
    { domain: debouncedDomain },
    { enabled: isValid, refetchInterval: 5000 },
  );

  useEffect(() => {
    const { success } = DomainSchema.safeParse(debouncedDomain);
    setIsValidDebouncedDomain(success);
  }, [debouncedDomain]);

  useEffect(() => {
    const { success } = DomainSchema.safeParse(domain);
    setIsValidDomain(success);
  }, [domain]);

  if (!isValid) return null;

  return (
    <div
      data-pending={!data && isPending ? true : undefined}
      data-error={!data && !isPending && error ? true : undefined}
      className={cn(
        "group/card z-0 flex w-full flex-col items-start justify-start gap-1 rounded-lg border text-sm select-text",
        className,
      )}
    >
      {(!data || !dnsCheckData?.data.dns_configured) && (
        <div className="flex w-full items-start justify-start px-3 pt-2 pb-2.5">
          <div className="flex max-w-1/3 flex-col gap-0.5 pr-6">
            <p className="text-muted-foreground leading-tight">Type</p>
            <p className="leading-tight font-medium">A</p>
          </div>
          <div className="flex min-w-0 shrink flex-col gap-0.5 pr-6">
            <p className="text-muted-foreground leading-tight">Name</p>
            <p className="leading-tight font-medium">{domain}</p>
          </div>
          <div className="flex max-w-1/3 flex-col gap-0.5">
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
      )}
      {data && (
        <div
          data-configured={dnsCheckData?.data.dns_configured ? true : undefined}
          className="data-configured:text-success text-muted-foreground -mt-3 flex flex-row flex-wrap gap-1.5 px-3 py-3 data-configured:mt-0"
        >
          <div className="flex max-w-full items-center justify-start gap-1.5 pr-4">
            <div className="-ml-0.25 size-4 shrink-0">
              {dnsCheckData?.data.dns_configured ? (
                <CheckCircleIcon className="size-full" />
              ) : (
                <HourglassIcon className="animate-hourglass size-full" />
              )}
            </div>
            <p className="min-w-0 shrink leading-tight font-medium">
              {dnsCheckData?.data.dns_configured ? "DNS detected" : "Waiting for DNS record..."}
            </p>
          </div>
          {dnsCheckData?.data.cloudflare && (
            <div className="flex max-w-full items-center justify-start gap-1.5 pr-4">
              <div className="-ml-0.25 size-4 shrink-0">
                <BrandIcon brand="cloudflare" className="size-full scale-110" />
              </div>
              <p className="min-w-0 shrink leading-tight font-medium">Cloudflare detected</p>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="w-full px-1.5 pb-1.5">
          <ErrorLine message={error.message} className="rounded-md" />
        </div>
      )}
    </div>
  );
}
