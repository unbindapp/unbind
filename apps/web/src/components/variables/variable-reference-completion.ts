// Works out whether the cursor sits somewhere a reference could be inserted,
// which is the only place the reference dropdown should open. A bare "$" counts
// as well as a half-typed "${", so picking an option writes the whole
// ${Source.KEY} form rather than making you type the brace.
// Kept free of CodeMirror imports so it runs under `node --test`.

import { parser } from "./variable-reference.gen.ts";

export type TReferenceTarget = { from: number; to: number };

export function resolveReferenceTarget(value: string, pos: number): TReferenceTarget | null {
  const tree = parser.parse(value);
  let node = tree.resolveInner(pos, -1);
  while (node.parent && node.name !== "IncompleteReference" && node.name !== "Dollar") {
    node = node.parent;
  }

  // "$" only counts with the cursor right after it; "a$b" mid-word does not.
  if (node.name === "Dollar") {
    if (pos !== node.to) return null;
    return { from: node.from, to: node.to };
  }

  if (node.name !== "IncompleteReference") return null;
  if (pos < node.from + 2) return null;
  return { from: node.from, to: node.to };
}
