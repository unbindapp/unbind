import type { LoaderPlugin } from "fumadocs-core/source";
import { cn } from "@/lib/cn";

const colorClasses = {
  success: "text-success bg-success/5-10 border-success/5-10",
  process: "text-process bg-process/5-10 border-process/5-10",
  warning: "text-warning bg-warning/5-10 border-warning/5-10",
};

export type TabColor = keyof typeof colorClasses;

// Wraps a root folder's icon in a tinted box, colored by the `color` field of its meta.json.
export function tabColorsPlugin(): LoaderPlugin {
  return {
    name: "unbind:tab-colors",
    enforce: "post",
    transformPageTree: {
      folder(node, _folderPath, metaPath) {
        if (!node.root || !metaPath) return node;

        const meta = this.storage.read(metaPath);
        if (meta?.format !== "meta") return node;

        const color = (meta.data as { color?: TabColor }).color;
        if (!color) return node;

        return {
          ...node,
          icon: (
            <span
              className={cn(
                "flex size-full items-center justify-center rounded-md border [&_svg]:size-4",
                colorClasses[color],
              )}
            >
              {node.icon}
            </span>
          ),
        };
      },
    },
  };
}
