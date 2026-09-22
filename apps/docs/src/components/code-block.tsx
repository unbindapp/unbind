import { cn } from "@/lib/cn";
import { shikiThemes } from "@/lib/theme/shiki-theme";
import { defaultShikiFactory } from "fumadocs-core/highlight/shiki/full";
import { CodeBlock as FumaCodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock.core";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { DynamicCodeblockProps } from "fumadocs-ui/components/dynamic-codeblock.core";
import { useRef, useState, type ComponentProps } from "react";

// The copy button of code blocks, styled like apps/web's CopyButton. Fumadocs' own
// button uses a clipboard icon and cannot be swapped, so the block renders this
// through its Actions slot instead.
function CopyCodeButton() {
  const ref = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const timeout = useRef<number>(undefined);

  function copy() {
    const pre = ref.current?.closest(".shiki")?.querySelector("pre");
    if (!pre) return;

    const clone = pre.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".nd-copy-ignore").forEach((node) => node.replaceWith("\n"));
    void navigator.clipboard.writeText(clone.textContent ?? "");

    setCopied(true);
    window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      data-copied={copied || undefined}
      onClick={copy}
      className="group/button text-muted-more-foreground has-hover:hover:bg-border has-hover:hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
    >
      <span className="relative size-4.5 transition-transform group-data-copied/button:rotate-45">
        <CopyIcon className="size-full group-data-copied/button:opacity-0" />
        <CheckIcon
          strokeWidth={3}
          className="group-data-copied/button:text-success absolute top-0 left-0 size-full -rotate-45 opacity-0 group-data-copied/button:opacity-100"
        />
      </span>
    </button>
  );
}

function CodeActions({ className }: { className?: string }) {
  return (
    <div className={cn(className, "flex items-center")}>
      <CopyCodeButton />
    </div>
  );
}

const codeblockProps = { allowCopy: false, Actions: CodeActions } as const;

export function CodeBlock(props: ComponentProps<typeof FumaCodeBlock>) {
  return (
    <FumaCodeBlock {...props} {...codeblockProps}>
      <Pre>{props.children}</Pre>
    </FumaCodeBlock>
  );
}

export function ApiCodeBlock(props: Omit<DynamicCodeblockProps, "highlighter" | "options">) {
  return (
    <DynamicCodeBlock
      {...props}
      highlighter={() => defaultShikiFactory.getOrInit()}
      options={{ themes: shikiThemes, defaultColor: false }}
      codeblock={codeblockProps}
    />
  );
}
