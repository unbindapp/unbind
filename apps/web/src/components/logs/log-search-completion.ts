// Works out what the cursor is sitting on so the completion source knows what
// to offer. Kept free of CodeMirror imports so it runs under `node --test`;
// the field re-parses on each request, which is nothing for a one-line query.

import { parser } from "./log-search.gen.ts";

export type TCompletionTarget =
  | { kind: "key"; from: number; to: number }
  | { kind: "value"; key: string; from: number; to: number };

export function resolveCompletionTarget(doc: string, pos: number): TCompletionTarget | null {
  const tree = parser.parse(doc);
  let node = tree.resolveInner(pos, -1);
  while (node.parent && node.name !== "Attribute") node = node.parent;
  if (node.name !== "Attribute") return null;

  const keyNode = node.getChild("AttrKey");
  if (!keyNode) return null;

  const colon = node.getChild("Colon");
  if (!colon || pos <= colon.from) {
    return { kind: "key", from: node.from, to: keyNode.to };
  }

  const valueNode = node.getChild("AttrValue");
  return {
    kind: "value",
    key: doc.slice(keyNode.from + 1, keyNode.to),
    from: colon.to,
    to: valueNode ? valueNode.to : pos,
  };
}
