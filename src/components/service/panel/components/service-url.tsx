import { Button, LinkButton } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";
import { THostFromServiceGet } from "@/server/trpc/api/services/types";
import { ChevronUpIcon, ExternalLinkIcon, GlobeIcon, HourglassIcon } from "lucide-react";
import { ReactNode, useState } from "react";

type TServiceUrlProps = { className?: string } & (
  | {
      hostObject: THostFromServiceGet;
      isPlaceholder?: never;
    }
  | {
      hostObject?: never;
      isPlaceholder: true;
    }
);

export default function ServiceUrl({ hostObject, isPlaceholder, className }: TServiceUrlProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (isPlaceholder) {
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

  if (!hostObject.tls_issued) {
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
                <HourglassIcon className="animate-hourglass size-full group-data-open/button:animate-none group-data-open/button:opacity-0" />
                <ChevronUpIcon className="absolute top-0 left-0 size-full scale-110 -rotate-90 opacity-0 group-data-open/button:opacity-100" />
              </div>
              <p className="min-w-0 shrink truncate">{getUrlDisplayStr(hostObject)}</p>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="flex w-72 flex-col gap-0.5 p-2">
            <div className="flex w-full flex-col gap-1.5 px-2 py-0.5">
              <div className="text-warning flex w-full justify-start gap-1.5">
                <HourglassIcon className="animate-hourglass mt-0.75 -ml-0.5 size-3.5 shrink-0" />
                <p className="min-w-0 shrink text-base leading-tight font-semibold">
                  Issuing the certificate
                </p>
              </div>
              <p className="w-full text-sm leading-snug">
                The TLS certificate is being issued. This can take a few minutes...
              </p>
            </div>
            <LinkButton
              className="group/button mt-2 min-w-0 shrink px-2.25 py-1.5 text-left font-medium"
              variant="outline"
              target="_blank"
              size="sm"
              href={getUrl(hostObject)}
            >
              <div className="relative -ml-0.5 size-3.5 shrink-0 transition-transform group-active/button:rotate-45 has-hover:group-hover/button:rotate-45">
                <GlobeIcon className="size-full group-active/button:opacity-0 has-hover:group-hover/button:opacity-0" />
                <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active/button:opacity-100 has-hover:group-hover/button:opacity-100" />
              </div>
              <p className="min-w-0 shrink truncate">Visit</p>
            </LinkButton>
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
        href={getUrl(hostObject)}
      >
        <div className="relative -ml-0.5 size-3.5 shrink-0 transition-transform group-active/button:rotate-45 has-hover:group-hover/button:rotate-45">
          <GlobeIcon className="size-full group-active/button:opacity-0 has-hover:group-hover/button:opacity-0" />
          <ExternalLinkIcon className="absolute top-0 left-0 size-full -rotate-45 opacity-0 group-active/button:opacity-100 has-hover:group-hover/button:opacity-100" />
        </div>
        <p className="min-w-0 shrink truncate">{getUrlDisplayStr(hostObject)}</p>
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

function getUrlDisplayStr(hostObj: THostFromServiceGet) {
  return hostObj.host + (hostObj.path === "/" ? "" : hostObj.path);
}

function getUrl(hostObj: THostFromServiceGet) {
  return "https://" + hostObj.host + hostObj.path;
}
