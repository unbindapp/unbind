import {
  createVariableReferenceLanguage,
  type TVariableReferenceData,
} from "@/components/variables/variable-reference-language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from "@codemirror/view";

const envName = Decoration.mark({ class: "tok-env-name" });
const envPunctuation = Decoration.mark({ class: "tok-env-punct" });
const namePattern = /^([A-Za-z_][A-Za-z0-9_.-]*)(=)/;

// Marks the NAME= prefix of every line; references inside the value are
// decorated by the shared reference language.
const envLineHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = build(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function build(view: EditorView) {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    let position = from;
    while (position <= to) {
      const line = view.state.doc.lineAt(position);
      const match = namePattern.exec(line.text);
      if (match) {
        const nameEnd = line.from + match[1].length;
        builder.add(line.from, nameEnd, envName);
        builder.add(nameEnd, nameEnd + 1, envPunctuation);
      }
      position = line.to + 1;
    }
  }
  return builder.finish();
}

export function createEnvVariablesLanguage<T>(getData: () => TVariableReferenceData<T>) {
  return createVariableReferenceLanguage(getData, [envLineHighlighter]);
}
