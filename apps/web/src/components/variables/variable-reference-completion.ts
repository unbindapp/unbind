// Works out whether the cursor sits somewhere a reference could be inserted,
// which is the only place the reference dropdown should open. A bare "$" counts
// as well as a half-typed "${", so picking an option writes the whole
// ${Source.KEY} form rather than making you type the brace.
// Kept free of CodeMirror imports so it runs under `node --test`.

import { parser } from "./variable-reference.gen.ts";

export type TReferenceTarget = { from: number; to: number };
export type TReferenceInsertion = { from: number; to: number; insert: string };

const targetNames = new Set(["IncompleteReference", "Dollar", "Reference"]);

function nodeAt(value: string, pos: number, side: -1 | 1 = -1) {
  const tree = parser.parse(value);
  let node = tree.resolveInner(pos, side);
  while (node.parent && !targetNames.has(node.name)) node = node.parent;
  return node;
}

function typedTarget(node: ReturnType<typeof nodeAt>, pos: number): TReferenceTarget | null {
  // "$" only counts with the cursor right after it; "a$b" mid-word does not.
  if (node.name === "Dollar") {
    if (pos !== node.to) return null;
    return { from: node.from, to: node.to };
  }

  if (node.name !== "IncompleteReference") return null;
  if (pos < node.from + 2) return null;
  // Ends at the cursor, not at the node: an unclosed reference runs to the end
  // of the line, and the dropdown matches against the text it covers, so
  // anything typed after the cursor would be matched against and then replaced.
  return { from: node.from, to: pos };
}

export function resolveReferenceTarget(value: string, pos: number): TReferenceTarget | null {
  return typedTarget(nodeAt(value, pos), pos);
}

/** A finished ${...} the trigger would land in or against, which would merge the two. */
function collidingReference(value: string, pos: number) {
  const before = nodeAt(value, pos, -1);
  if (before.name === "Reference" && pos > before.from && pos < before.to) return before;

  const ahead = nodeAt(value, pos, 1);
  if (ahead.name === "Reference" && pos === ahead.from) return ahead;

  return null;
}

/**
 * What the trigger button writes so the dropdown opens. It writes the trigger
 * rather than forcing the menu open, because that is the state the completion
 * source already recognises: typing on from there keeps narrowing the list,
 * where a bare "variable" would match nothing and close it.
 */
export function resolveReferenceInsertion(value: string, pos: number): TReferenceInsertion {
  // Already on a trigger. Writing a second one would only make "${${", which
  // matches nothing, so the cursor stays put and keeps whatever was typed.
  if (resolveReferenceTarget(value, pos)) return { from: pos, to: pos, insert: "" };

  // "${" written into or straight against a finished reference is swallowed by
  // it, leaving one malformed reference, so the new one goes after it.
  const collision = collidingReference(value, pos);
  if (collision) return { from: collision.to, to: collision.to, insert: "${" };

  return { from: pos, to: pos, insert: "${" };
}
