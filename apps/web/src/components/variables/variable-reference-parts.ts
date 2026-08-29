// Splits a variable value into text and reference parts. Replaces the old
// string-matching splitByTokens so the editor, the read-only card and the API
// payload builder all read the same grammar.
//
// A ${...} that isn't in the known reference list stays text, which is what the
// old lookup-by-value behaviour did too.
// Uses relative imports so it can run under `node --test`.

import { parser } from "./variable-reference.gen.ts";

export type TReferencePart<T> = {
  value: string;
  from: number;
  to: number;
  reference: T | null;
};

export function splitByReferences<T>(
  value: string,
  referencesByValue: ReadonlyMap<string, T>,
): TReferencePart<T>[] {
  if (!value) return [{ value, from: 0, to: 0, reference: null }];

  const parts: TReferencePart<T>[] = [];
  const pushText = (text: string, from: number, to: number) => {
    const previous = parts[parts.length - 1];
    if (previous && previous.reference === null) {
      previous.value += text;
      previous.to = to;
      return;
    }
    parts.push({ value: text, from, to, reference: null });
  };

  const cursor = parser.parse(value).cursor();
  if (cursor.firstChild()) {
    do {
      const text = value.slice(cursor.from, cursor.to);
      if (cursor.name !== "Reference") {
        pushText(text, cursor.from, cursor.to);
        continue;
      }
      const reference = referencesByValue.get(text);
      if (reference === undefined) {
        pushText(text, cursor.from, cursor.to);
        continue;
      }
      parts.push({ value: text, from: cursor.from, to: cursor.to, reference });
    } while (cursor.nextSibling());
  }

  if (parts.length === 0) return [{ value, from: 0, to: value.length, reference: null }];
  return parts;
}
