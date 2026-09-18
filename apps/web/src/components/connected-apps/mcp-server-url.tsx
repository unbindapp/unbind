import CopyButton from "@/components/copy-button";
import { cn } from "@/components/ui/utils";

type TProps = {
  className?: string;
};

export default function McpServerUrl({ className }: TProps) {
  const url = `${window.location.origin}/mcp`;

  return (
    <div className={cn("flex w-full flex-col gap-2 rounded-xl border p-3", className)}>
      <div className="flex w-full flex-col gap-0.5 px-1">
        <p className="leading-tight font-semibold">MCP Server</p>
        <p className="text-muted-foreground text-sm leading-tight">
          Add this URL to an MCP client such as Claude, ChatGPT, Cursor or VS Code. It asks you to
          approve the access here. Claude and ChatGPT connect from the internet, so they only work
          if this Unbind instance is publicly reachable.
        </p>
      </div>
      <div className="flex w-full items-start gap-2">
        <p
          className="bg-input min-w-0 flex-1 rounded-lg border px-3 py-2.5 font-mono text-sm break-all"
          aria-label="MCP server URL"
        >
          {url}
        </p>
        <CopyButton valueToCopy={url} variant="outline" className="size-10.5 rounded-lg" />
      </div>
    </div>
  );
}
