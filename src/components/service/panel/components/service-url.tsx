import ErrorLine from "@/components/error-line";
import { DomainCard } from "@/components/service/panel/content/undeployed/domain-card";
import { Button, LinkButton } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { TExternalEndpoint } from "@/server/trpc/api/services/types";
import {
  ChevronUpIcon,
  ExternalLinkIcon,
  GlobeIcon,
  HourglassIcon,
  LoaderIcon,
} from "lucide-react";
import { ReactNode, useState } from "react";

type TServiceUrlProps = { className?: string } & (
  | {
      endpoint: TExternalEndpoint;
      isPlaceholder?: never;
      error?: never;
    }
  | {
      endpoint?: never;
      isPlaceholder: true;
      error: string | undefined;
    }
);

export default function ServiceUrl({
  endpoint,
  isPlaceholder,
  error,
  className,
}: TServiceUrlProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (isPlaceholder) {
    if (error) {
      return (
        <Wrapper className={className}>
          <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                data-open={isDropdownOpen ? true : undefined}
                className="text-muted-foreground group/button min-w-0 shrink px-2.25 py-1 text-left font-medium"
                variant="ghost"
                size="sm"
              >
                <div className="text-destructive relative -ml-0.5 size-3.5 shrink-0 transition-transform group-data-open/button:rotate-90">
                  <GlobeIcon className="size-full group-data-open/button:opacity-0" />
                  <ChevronUpIcon className="absolute top-0 left-0 size-full scale-110 -rotate-90 opacity-0 group-data-open/button:opacity-100" />
                </div>
                <p className="text-destructive min-w-0 shrink truncate">Error</p>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-128 flex-col gap-0.5 p-0">
              <ScrollArea>
                <ErrorLine message={error} className="bg-transparent px-3.5 py-2" />
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </Wrapper>
      );
    }

    return (
      <Wrapper className={className}>
        <div className="animate-skeleton flex min-w-0 shrink items-center gap-1.5 px-2.25 py-1 text-left text-sm font-medium text-transparent">
          <div className="relative -ml-0.5 size-3.5 shrink-0">
            <GlobeIcon className="bg-muted-foreground size-full rounded-full" />
          </div>
          <p className="bg-muted-foreground min-w-0 shrink truncate rounded-md">app.loading.com</p>
        </div>
      </Wrapper>
    );
  }

  if (
    endpoint.dns_status === "unresolved" ||
    endpoint.tls_status === "pending" ||
    endpoint.tls_status === "attempting"
  ) {
    return (
      <Wrapper className={className}>
        <Popover open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              data-open={isDropdownOpen ? true : undefined}
              className="text-muted-foreground group/button min-w-0 shrink px-2.25 py-1 text-left font-medium"
              variant="ghost"
              size="sm"
            >
              <div className="relative -ml-0.5 size-3.5 shrink-0 transition-transform group-data-open/button:rotate-90">
                {endpoint.tls_status === "pending" || endpoint.dns_status === "unresolved" ? (
                  <HourglassIcon className="animate-hourglass size-full group-data-open/button:animate-none group-data-open/button:opacity-0" />
                ) : (
                  <LoaderIcon className="size-full animate-spin group-data-open/button:animate-none group-data-open/button:opacity-0" />
                )}
                <ChevronUpIcon className="absolute top-0 left-0 size-full scale-110 -rotate-90 opacity-0 group-data-open/button:opacity-100" />
              </div>
              <p className="min-w-0 shrink truncate">{getUrlDisplayStr(endpoint)}</p>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            data-unresolved={endpoint.dns_status === "unresolved" ? true : undefined}
            align="start"
            className="group/popover flex w-72 flex-col gap-0.5 overflow-hidden p-0 data-unresolved:w-90"
          >
            <ScrollArea className="flex min-h-0 w-full flex-none shrink flex-col justify-start p-2">
              {endpoint.dns_status === "unresolved" ? (
                <DomainCard
                  className="-mt-2 -mb-1 border-none"
                  domain={endpoint.host}
                  paragraph="Create the DNS record below."
                />
              ) : (
                <div className="flex w-full flex-col gap-1.5 px-2 py-0.5">
                  <div className="text-warning flex w-full justify-start gap-1.5">
                    {endpoint.tls_status === "pending" ? (
                      <HourglassIcon className="animate-hourglass mt-0.75 -ml-0.5 size-3.5 shrink-0" />
                    ) : (
                      <LoaderIcon className="mt-0.75 -ml-0.5 size-3.5 shrink-0 animate-spin" />
                    )}
                    <p className="min-w-0 shrink text-base leading-tight font-semibold">
                      {endpoint.tls_status === "pending"
                        ? "Waiting for deployment"
                        : "Issuing the certificate"}
                    </p>
                  </div>
                  <p className="w-full text-sm leading-snug">
                    {endpoint.tls_status === "pending"
                      ? "The TLS certificate will be issued once the first deployment is complete."
                      : "The TLS certificate is being issued. This can take a few minutes..."}
                  </p>
                </div>
              )}
              <LinkButton
                className="group/button mt-2 min-w-0 shrink px-2.25 py-1.5 text-left font-medium"
                variant="outline"
                target="_blank"
                size="sm"
                forceMinSize={false}
                href={getUrl(endpoint)}
              >
                <div className="relative -ml-0.5 size-3.5 shrink-0 transition-transform group-active/button:rotate-45 has-hover:group-hover/button:rotate-45">
                  <GlobeIcon className="size-full group-active/button:opacity-0 has-hover:group-hover/button:opacity-0" />
                  <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active/button:opacity-100 has-hover:group-hover/button:opacity-100" />
                </div>
                <p className="min-w-0 shrink truncate">Visit</p>
              </LinkButton>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </Wrapper>
    );
  }

  return (
    <Wrapper className={className}>
      <LinkButton
        className="text-muted-foreground group/button min-w-0 shrink px-2.25 py-1 text-left font-medium"
        variant="ghost"
        target="_blank"
        size="sm"
        href={getUrl(endpoint)}
      >
        <div className="relative -ml-0.5 size-3.5 shrink-0 transition-transform group-active/button:rotate-45 has-hover:group-hover/button:rotate-45">
          <GlobeIcon className="size-full group-active/button:opacity-0 has-hover:group-hover/button:opacity-0" />
          <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active/button:opacity-100 has-hover:group-hover/button:opacity-100" />
        </div>
        <p className="min-w-0 shrink truncate">{getUrlDisplayStr(endpoint)}</p>
      </LinkButton>
    </Wrapper>
  );
}

function Wrapper({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex max-w-full items-start justify-start sm:max-w-full", className)}>
      {children}
    </div>
  );
}

function getUrlDisplayStr(endpoint: TExternalEndpoint) {
  return endpoint.host + (endpoint.path === "/" ? "" : endpoint.path);
}

function getUrl(endpoint: TExternalEndpoint) {
  return "https://" + endpoint.host + endpoint.path;
}
