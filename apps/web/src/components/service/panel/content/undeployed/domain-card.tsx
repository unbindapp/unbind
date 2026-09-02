import ErrorLine from "@/components/error-line";
import BrandIcon from "@/components/icons/brand";
import { useSystem } from "@/components/system/system-provider";
import { cn } from "@/components/ui/utils";
import { defaultDebounceMs } from "@/lib/constants";
import { isDomain } from "@/lib/helpers/is-domain";
import { dnsCheckQuery } from "@/lib/queries/system";
import { DNSStatus } from "@/lib/server/client.gen";
import { useQuery } from "@tanstack/react-query";
import { CheckCircleIcon, HourglassIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

type TDomainStatusCardProps = {
  domain: string;
  dnsStatus: DNSStatus | undefined;
  isCloudflare: boolean | undefined;
  paragraph?: string;
  className?: string;
  hideInstructions?: boolean;
};

export type TSavedDomainStatus = {
  domain: string;
  dnsStatus: DNSStatus;
  isCloudflare: boolean;
};

export function DomainCard({
  domain,
  paragraph,
  className,
  savedStatus,
}: Omit<TDomainStatusCardProps, "dnsStatus" | "isCloudflare"> & {
  savedStatus?: TSavedDomainStatus;
}) {
  const [isValidDebouncedDomain, setIsValidDebouncedDomain] = useState(false);
  const [isValidDomain, setIsValidDomain] = useState(false);

  const [debouncedDomain] = useDebounce(domain, defaultDebounceMs);

  const isValid = isValidDebouncedDomain && isValidDomain;
  const isSaved = savedStatus !== undefined && domain === savedStatus.domain;
  const isSavedDebounced = savedStatus !== undefined && debouncedDomain === savedStatus.domain;

  const { data: dnsCheckData } = useQuery({
    ...dnsCheckQuery({ domain: debouncedDomain }),
    enabled: isValid && !isSaved && !isSavedDebounced,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const isValid = isDomain(debouncedDomain);
    setIsValidDebouncedDomain(isValid);
  }, [debouncedDomain]);

  useEffect(() => {
    const isValid = isDomain(domain);
    setIsValidDomain(isValid);
  }, [domain]);

  if (!isValid) return null;

  if (isSaved) {
    return (
      <DomainStatusCard
        domain={domain}
        dnsStatus={savedStatus.dnsStatus}
        isCloudflare={savedStatus.isCloudflare}
        paragraph="Create the DNS record below."
        className={className}
      />
    );
  }

  return (
    <DomainStatusCard
      domain={domain}
      dnsStatus={dnsCheckData?.data.dns_status}
      isCloudflare={dnsCheckData?.data.is_cloudflare}
      paragraph={paragraph}
      className={className}
    />
  );
}

export function DomainStatusCard({
  domain,
  dnsStatus,
  isCloudflare,
  paragraph = "Create the DNS record below. You can also do it later.",
  className,
  hideInstructions,
}: TDomainStatusCardProps) {
  const { data, isPending, error } = useSystem();
  const isResolved = getIsResolved(dnsStatus);

  return (
    <div
      data-configured={(data && isResolved) || undefined}
      data-pending={(!data && isPending) || undefined}
      data-error={(!data && !isPending && error) || undefined}
      className={cn(
        "group/card data-configured:bg-success/6 data-configured:border-success/10 z-0 flex w-full flex-col items-start justify-start rounded-lg border text-sm select-text",
        className,
      )}
    >
      {!hideInstructions && (!data || !isResolved) && (
        <div className="flex w-full flex-col items-start justify-start">
          <p className="w-full px-3 py-2.5 leading-tight font-medium">{paragraph}</p>
          <div className="flex w-full items-start justify-start border-t border-b px-3 pt-2 pb-2.5">
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
        </div>
      )}
      {data && <DomainStatusRow dnsStatus={dnsStatus} isCloudflare={!!isCloudflare} />}
      {error && (
        <div className="w-full p-1.5">
          <ErrorLine message={error.message} className="rounded-md" />
        </div>
      )}
    </div>
  );
}

function getIsResolved(dnsStatus: DNSStatus | undefined) {
  return dnsStatus === "resolved";
}

export function DomainStatusRow({
  dnsStatus,
  isCloudflare,
  className,
}: Pick<TDomainStatusCardProps, "dnsStatus" | "isCloudflare"> & { className?: string }) {
  const isResolved = getIsResolved(dnsStatus);
  const { data } = useSystem();
  return (
    <div
      data-configured={(data && isResolved) || undefined}
      className={cn(
        "data-configured:text-success group-data-configured/card:text-success text-muted-foreground flex w-full flex-row flex-wrap gap-1.5 px-3 py-2.5 leading-tight font-medium group-data-configured/card:mt-0",
        className,
      )}
    >
      <div className="flex max-w-full items-center justify-start gap-1.5 pr-4">
        <div className="size-3.5 shrink-0">
          {isResolved ? (
            <CheckCircleIcon className="size-full" />
          ) : (
            <HourglassIcon className="animate-hourglass size-full" />
          )}
        </div>
        <p className="min-w-0 shrink">
          {isResolved ? "DNS record detected" : "Waiting for DNS record"}
        </p>
      </div>
      {isCloudflare && (
        <div className="flex max-w-full items-center justify-start gap-1.5 pr-4">
          <div className="size-3.5 shrink-0">
            <BrandIcon brand="cloudflare" className="size-full" />
          </div>
          <p className="min-w-0 shrink">Cloudflare detected</p>
        </div>
      )}
    </div>
  );
}
