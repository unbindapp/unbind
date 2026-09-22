import { CopyStateIcon } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCopyToClipboard } from "@/lib/use-copy";
import { usePathname } from "fumadocs-core/framework";
import { ChevronDownIcon, ExternalLinkIcon, TextIcon } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";

export function CopyMarkdownButton({ markdownUrl }: { markdownUrl: string }) {
  const { markCopied, isRecentlyCopied } = useCopyToClipboard();
  const pending = useRef(false);

  async function copy() {
    if (pending.current) return;
    pending.current = true;
    try {
      const text = fetch(markdownUrl).then((res) => res.text());
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": text })]);
      markCopied();
    } finally {
      pending.current = false;
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-copied={isRecentlyCopied || undefined}
      onClick={copy}
      className="px-2.5"
    >
      <CopyStateIcon className="-ml-px size-4" />
      Copy Markdown
    </Button>
  );
}

function GitHubIcon() {
  return (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1.26a11 11 0 0 0-11 11c0 4.862 3.157 8.987 7.524 10.45.55.088.726-.253.726-.55v-1.859c-3.047.66-3.696-1.474-3.696-1.474-.506-1.276-1.221-1.617-1.221-1.617-1.001-.682.077-.66.077-.66 1.1.077 1.683 1.133 1.683 1.133.957 1.672 2.574 1.177 3.201.913.099-.715.385-1.199.693-1.474-2.442-.275-5.005-1.221-5.005-5.412 0-1.221.418-2.2 1.133-2.981-.11-.275-.495-1.419.11-2.904 0 0 .924-.297 3.025 1.122A10.4 10.4 0 0 1 12 6.584c.935 0 1.881.121 2.75.363 2.101-1.419 3.025-1.122 3.025-1.122.605 1.485.22 2.629.11 2.904.715.781 1.133 1.76 1.133 2.981 0 4.202-2.574 5.126-5.027 5.401.396.341.759 1.012.759 2.035v3.014c0 .297.176.649.737.55C19.854 21.236 23 17.122 23 12.26a11 11 0 0 0-11-11" />
    </svg>
  );
}

function ClaudeIcon() {
  return (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.316 15.63l4.329-2.427.072-.211-.072-.118h-.211l-.724-.044-2.473-.067-2.146-.089-2.078-.111-.523-.112-.49-.646.05-.322.44-.295.63.055 1.392.095 2.089.144 1.515.089 2.245.233h.356l.05-.144-.12-.09-.096-.088-2.162-1.464L5.05 8.47l-1.225-.89-.662-.452-.335-.423-.144-.924.602-.662.808.055.206.055.819.63 1.749 1.352 2.283 1.68.334.278.134-.095.016-.067-.15-.25-1.242-2.244-1.325-2.282-.59-.946-.156-.567a2.758 2.758 0 0 1-.095-.668l.685-.93L7.14 1l.914.122.384.334.568 1.297.92 2.043 1.425 2.778.418.824.223.763.083.233h.144v-.133l.117-1.565.217-1.921.211-2.472.073-.697.345-.834.685-.451.534.255.44.63-.06.406-.262 1.699-.513 2.66-.334 1.782h.195l.222-.223.902-1.196 1.515-1.893.669-.752.78-.83.5-.394h.947l.697 1.034-.312 1.07-.975 1.235-.808 1.046-1.159 1.56-.723 1.246.067.1.172-.017 2.617-.556 1.415-.256 1.687-.29.764.357.083.363-.3.74-1.805.446-2.117.423-3.152.745-.039.028.045.055 1.42.134.608.033h1.487l2.769.206.723.478.434.585-.073.445-1.114.567-1.503-.356-3.51-.834-1.203-.3h-.166v.1l1.003.98 1.837 1.658 2.302 2.138.117.528-.296.417-.312-.044-2.022-1.52-.78-.685-1.766-1.486h-.117v.156l.407.595 2.15 3.23.11.99-.155.322-.557.194-.612-.111-1.258-1.765-1.299-1.988-1.047-1.782-.128.073-.618 6.653-.29.34-.668.255-.557-.423-.296-.685.296-1.352.356-1.765.29-1.403.261-1.743.156-.58-.01-.038-.128.016-1.315 1.804-2 2.7-1.581 1.693-.38.15-.656-.34.061-.607.367-.54 2.19-2.784 1.32-1.725.853-.997-.006-.144h-.05l-5.816 3.775-1.036.133-.445-.417.055-.684.21-.223 1.75-1.203-.007.006.002.006z" />
    </svg>
  );
}

function ChatGPTIcon() {
  return (
    <svg fill="currentColor" role="img" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.36 9.492a5.592 5.592 0 0 0-1.448-5.404 5.592 5.592 0 0 0-5.404-1.449 5.592 5.592 0 0 0-5.404-1.447 5.592 5.592 0 0 0-3.957 3.955 5.592 5.592 0 0 0-3.955 3.957 5.592 5.592 0 0 0 1.447 5.404 5.593 5.593 0 0 0 1.45 5.404 5.592 5.592 0 0 0 5.403 1.449 5.593 5.593 0 0 0 5.404 1.447c2-.536 3.455-2.09 3.957-3.955a5.592 5.592 0 0 0 3.955-3.957c.536-2-.083-4.037-1.447-5.404zm-2.347-4.505a4.317 4.317 0 0 1 1.228 3.637l-4.66-2.69a.635.635 0 0 0-.634 0l-5.455 3.15V7.018c0-.144.077-.28.203-.352l4.154-2.399a4.326 4.326 0 0 1 5.164.72zM12 9.104l2.508 1.448v2.896L12 14.896l-2.508-1.448v-2.896L12 9.104zM6.228 6.533a4.326 4.326 0 0 1 6.969-3.357l-4.66 2.69a.635.635 0 0 0-.317.549v6.299L6.432 11.68a.409.409 0 0 1-.204-.352V6.532zm-3.808 2.9a4.317 4.317 0 0 1 2.536-2.881v5.38c0 .226.12.436.317.549l5.455 3.15-1.788 1.032a.408.408 0 0 1-.407 0l-4.154-2.398a4.326 4.326 0 0 1-1.96-4.832zm2.567 9.58a4.317 4.317 0 0 1-1.228-3.637l4.66 2.69a.635.635 0 0 0 .634 0l5.455-3.15v2.066c0 .145-.077.28-.203.353l-4.154 2.398a4.326 4.326 0 0 1-5.164-.72zm12.785-1.545a4.326 4.326 0 0 1-6.968 3.357l4.659-2.69a.634.634 0 0 0 .317-.55v-6.299l1.789 1.033a.409.409 0 0 1 .203.352v4.797zm3.808-2.901a4.317 4.317 0 0 1-2.536 2.882v-5.38a.635.635 0 0 0-.317-.55l-5.455-3.15 1.788-1.032a.409.409 0 0 1 .407 0l4.154 2.398a4.326 4.326 0 0 1 1.96 4.832z" />
    </svg>
  );
}

type Item = { title: string; href: string; icon: ReactNode };

export function ViewOptionsPopover({
  markdownUrl,
  githubUrl,
}: {
  markdownUrl: string;
  githubUrl?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const items = useMemo<Item[]>(() => {
    const pageUrl =
      typeof window === "undefined" ? pathname : new URL(pathname, window.location.origin);
    const prompt = `Read ${pageUrl}, I want to ask questions about it.`;

    const items: Item[] = [
      { title: "View as Markdown", href: markdownUrl, icon: <TextIcon /> },
      {
        title: "Open in Claude",
        href: `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`,
        icon: <ClaudeIcon />,
      },
      {
        title: "Open in ChatGPT",
        href: `https://chatgpt.com/?${new URLSearchParams({ prompt, hints: "search" })}`,
        icon: <ChatGPTIcon />,
      },
    ];
    if (githubUrl)
      items.unshift({ title: "Open in GitHub", href: githubUrl, icon: <GitHubIcon /> });
    return items;
  }, [githubUrl, markdownUrl, pathname]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            data-open={open || undefined}
            className="gap-1 px-2.5"
          />
        }
      >
        Open
        <ChevronDownIcon className="text-muted-foreground -mr-px size-4 transition group-data-open/button:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-52">
        <DropdownMenuGroup>
          {items.map((item) => (
            <DropdownMenuItem
              key={item.href}
              className="text-sm [&_svg]:size-4"
              render={<a href={item.href} rel="noreferrer noopener" target="_blank" />}
            >
              {item.icon}
              {item.title}
              <ExternalLinkIcon className="text-muted-foreground ml-auto size-3.5" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
