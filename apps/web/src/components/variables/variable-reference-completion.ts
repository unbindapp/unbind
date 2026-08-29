// Works out whether the cursor sits inside a reference that is still being
// typed, which is the only place the reference dropdown should open.
// Kept free of CodeMirror imports so it runs under `node --test`.

import { parser } from "./variable-reference.gen.ts";

export type TReferenceTarget = { from: number; to: number };

export function resolveReferenceTarget(value: string, pos: number): TReferenceTarget | null {
  const tree = parser.parse(value);
  let node = tree.resolveInner(pos, -1);
  while (node.parent && node.name !== "IncompleteReference") node = node.parent;
  if (node.name !== "IncompleteReference") return null;
  if (pos < node.from + 2) return null;
  return { from: node.from, to: node.to };
}
