import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/cn";
import { shikiThemes } from "@/lib/theme/shiki-theme";
import { defaultShikiFactory } from "fumadocs-core/highlight/shiki/full";
import { CodeBlock as FumaCodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock.core";
import type { DynamicCodeblockProps } from "fumadocs-ui/components/dynamic-codeblock.core";
import { useRef, type ComponentProps, type ReactNode } from "react";

// Fumadocs' own copy button uses a clipboard icon and cannot be swapped, so the block
// renders ours through its Actions slot instead.
function CodeActions({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function codeText() {
    const pre = ref.current?.closest(".shiki")?.querySelector("pre");
    if (!pre) return;

    const clone = pre.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".nd-copy-ignore").forEach((node) => node.replaceWith("\n"));
    return clone.textContent ?? "";
  }

  return (
    <div ref={ref} className={cn(className, "bg-card flex items-center")}>
      <CopyButton valueToCopy={codeText} className="size-8 rounded-md" />
    </div>
  );
}

const codeblockProps = { allowCopy: false, Actions: CodeActions } as const;

// The end padding keeps long lines clear of the copy button.
const preClassName = "pe-12";

export function CodeBlock(props: ComponentProps<typeof FumaCodeBlock>) {
  return (
    <FumaCodeBlock {...props} {...codeblockProps}>
      <Pre className={preClassName}>{props.children}</Pre>
    </FumaCodeBlock>
  );
}

function ApiPre({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <FumaCodeBlock {...codeblockProps} className={cn("my-0", className)}>
      <Pre className={preClassName}>{children}</Pre>
    </FumaCodeBlock>
  );
}

export function ApiCodeBlock(props: Omit<DynamicCodeblockProps, "highlighter" | "options">) {
  return (
    <DynamicCodeBlock
      {...props}
      highlighter={() => defaultShikiFactory.getOrInit()}
      options={{ themes: shikiThemes, defaultColor: false, components: { pre: ApiPre } }}
    />
  );
}
