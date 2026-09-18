import CopyButton from "@/components/copy-button";
import BrandIcon from "@/components/icons/brand";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { ReactNode } from "react";

type TProps = {
  className?: string;
};

export default function McpServerUrl({ className }: TProps) {
  const url = `${window.location.origin}/mcp`;

  return (
    <div className={cn("flex w-full flex-col gap-3 rounded-xl border p-3", className)}>
      <div className="flex w-full flex-col gap-1 px-1">
        <div className="flex w-full items-start gap-1.5 leading-tight">
          <div className="line-icon">
            <BrandIcon brand="mcp" className="size-4.5" />
          </div>
          <p className="min-w-0 shrink font-semibold">MCP Server</p>
        </div>
        <p className="text-muted-foreground text-sm">
          Add this URL to an MCP client such as{" "}
          <ClientLink brand="claude" href="https://claude.ai/#customize/connectors">
            Claude
          </ClientLink>{" "}
          or{" "}
          <ClientLink brand="chatgpt" href="https://chatgpt.com/plugins">
            ChatGPT
          </ClientLink>
          . You can pick what each one can access.
        </p>
      </div>
      <div className="flex w-full items-start gap-2">
        <Input value={url} readOnly />
        <CopyButton valueToCopy={url} variant="outline" className="size-10.5 rounded-lg" />
      </div>
    </div>
  );
}

function ClientLink({
  brand,
  href,
  children,
}: {
  brand: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground font-medium whitespace-nowrap underline-offset-2 active:underline has-hover:hover:underline"
    >
      <span className="inline-icon mr-[0.3ch]">
        <BrandIcon brand={brand} className="size-3.5" />
      </span>
      {children}
    </a>
  );
}
