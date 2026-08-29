import type { ReactNode } from "react";

// CodeMirror's completion options are plain DOM, but our icons are React
// components (BrandIcon uses useId for gradients), so each one is rendered once
// off-screen and cloned per option. Cloned gradient defs keep painting and
// currentColor still resolves per clone, so colors and dark mode work.
const rendered = new Map<string, HTMLElement>();

export type TCachedIcon = { key: string; node: ReactNode };

export function IconCache({ icons }: { icons: readonly TCachedIcon[] }) {
  return (
    <div aria-hidden className="pointer-events-none absolute h-0 w-0 overflow-hidden">
      {icons.map(({ key, node }) => (
        <span
          key={key}
          ref={(element) => {
            if (!element) return;
            rendered.set(key, element);
          }}
        >
          {node}
        </span>
      ))}
    </div>
  );
}

export function cloneCachedIcon(key: string | undefined): Node | null {
  if (!key) return null;
  const source = rendered.get(key)?.firstElementChild;
  if (!source) return null;
  return source.cloneNode(true);
}
