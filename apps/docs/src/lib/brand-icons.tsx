import BrandIcon from "@/components/icons/brand";
import type { LoaderPlugin } from "fumadocs-core/source";
import type * as PageTree from "fumadocs-core/page-tree";
import templates from "../../generated/templates.gen.json";

export const templateBrands: ReadonlySet<string> = new Set(
  templates.map((template) => template.icon),
);

// Turns a page's `icon` into a brand icon when the name is one the brand icon
// component knows. Runs before the Lucide plugin, which only touches string icons.
export function brandIconsPlugin(): LoaderPlugin {
  function replaceIcon<T extends PageTree.Node>(node: T): T {
    if (typeof node.icon !== "string" || !templateBrands.has(node.icon)) return node;
    return { ...node, icon: <BrandIcon brand={node.icon} /> };
  }
  return {
    name: "unbind:brand-icons",
    transformPageTree: { file: replaceIcon, folder: replaceIcon },
  };
}
