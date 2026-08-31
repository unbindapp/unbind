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

export function resolveReferenceTarget(value: string, pos: number): TReferenceTarget | null {
  const node = nodeAt(value, pos);

  // "$" only counts with the cursor right after it; "a$b" mid-word does not.
  if (node.name === "Dollar") {
    if (pos !== node.to) return null;
    return { from: node.from, to: node.to };
  }

  if (node.name !== "IncompleteReference") return null;
  if (pos < node.from + 2) return null;

  // Ends at the cursor, not at the node: an unclosed reference runs to the end
  // of the line, and the dropdown both matches on and replaces the text the
  // target covers, so anything ahead of the cursor has no business in it.
  return { from: node.from, to: pos };
}

/** Whether the dropdown would open once this insertion is applied. */
function opensDropdown(value: string, { from, to, insert }: TReferenceInsertion) {
  const applied = value.slice(0, from) + insert + value.slice(to);
  return resolveReferenceTarget(applied, from + insert.length) !== null;
}

/**
 * What the trigger button writes so the dropdown opens. It writes the trigger
 * rather than forcing the menu open, because that is the state the completion
 * source already recognises: typing on from there keeps narrowing the list,
 * where a bare "variable" would match nothing and close it.
 */
export function resolveReferenceInsertion(value: string, pos: number): TReferenceInsertion {
  const atCursor = { from: pos, to: pos, insert: "${" };

  const trigger = resolveReferenceTarget(value, pos);
  if (trigger) {
    // An empty trigger already opens the dropdown, and writing a second one
    // would leave the first behind as text. One with something typed into it
    // has stopped matching, so a fresh trigger goes after it.
    const written = value.slice(trigger.from, trigger.to);
    return written === "$" || written === "${" ? { from: pos, to: pos, insert: "" } : atCursor;
  }

  if (opensDropdown(value, atCursor)) return atCursor;

  // Something around the cursor swallows the trigger: a finished reference it
  // would land inside or against, or a "}" ahead of it that closes it off. The
  // end of the line is the one place nothing can, so it goes there instead.
  const lineEnd = value.indexOf("\n", pos);
  const end = lineEnd < 0 ? value.length : lineEnd;
  return { from: end, to: end, insert: "${" };
}
