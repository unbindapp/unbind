import type { LoaderPlugin } from "fumadocs-core/source";
import { cn } from "@/lib/cn";

const colorClasses = {
  success: "text-success",
  process: "text-process",
  warning: "text-warning",
};

export type TabColor = keyof typeof colorClasses;

// Colors a root folder's icon by the `color` field of its meta.json.
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
            <span className={cn("flex size-full items-center justify-center", colorClasses[color])}>
              {node.icon}
            </span>
          ),
        };
      },
    },
  };
}
