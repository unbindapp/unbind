import type { TCompletionAddition } from "@/components/ui/token-field/autocomplete";

function appendWithMatches(
  parent: Node,
  label: string,
  from: number,
  to: number,
  match: readonly number[],
) {
  let at = from;
  for (let i = 0; i < match.length; i += 2) {
    const start = Math.max(match[i], at);
    const end = Math.min(match[i + 1], to);
    if (end <= start) continue;
    if (start > at) parent.appendChild(document.createTextNode(label.slice(at, start)));
    const matched = document.createElement("span");
    matched.className = "cm-completionMatchedText";
    matched.textContent = label.slice(start, end);
    parent.appendChild(matched);
    at = end;
  }
  if (at < to) parent.appendChild(document.createTextNode(label.slice(at, to)));
}

function appendSegment(
  parent: Node,
  label: string,
  from: number,
  to: number,
  match: readonly number[],
  className: string,
) {
  if (from >= to) return;
  const span = document.createElement("span");
  span.className = className;
  appendWithMatches(span, label, from, to, match);
  parent.appendChild(span);
}

/**
 * Replaces the flat label on reference options with one that dims the
 * scaffolding and the source, mirroring the field's chip colouring. The
 * default label is hidden for these options in globals.css.
 */
export const referenceLabelCompletionAddition: TCompletionAddition = {
  position: 50,
  render: (completion, _state, _view, match = []) => {
    if (completion.type !== "reference") return null;

    const label = completion.displayLabel || completion.label;
    const wrapper = document.createElement("span");
    wrapper.className = "token-field-reference-label";

    if (!label.startsWith("${") || !label.endsWith("}")) {
      appendWithMatches(wrapper, label, 0, label.length, match);
      return wrapper;
    }

    const innerFrom = 2;
    const innerTo = label.length - 1;
    const dot = label.indexOf(".", innerFrom);
    const dotAt = dot > innerFrom && dot < innerTo - 1 ? dot : -1;

    appendSegment(wrapper, label, 0, innerFrom, match, "token-field-reference-punct");
    if (dotAt < 0) {
      appendWithMatches(wrapper, label, innerFrom, innerTo, match);
    } else {
      appendSegment(wrapper, label, innerFrom, dotAt + 1, match, "token-field-reference-source");
      appendWithMatches(wrapper, label, dotAt + 1, innerTo, match);
    }
    appendSegment(wrapper, label, innerTo, label.length, match, "token-field-reference-punct");

    return wrapper;
  },
};
