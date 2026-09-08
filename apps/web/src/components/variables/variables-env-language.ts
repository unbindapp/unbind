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

export type TEnvVariablesData<T> = TVariableReferenceData<T> & {
  /** Names with a staged change, colored apart from the rest */
  stagedNames: ReadonlySet<string>;
};

type TIsStaged = (name: string) => boolean;

const envName = Decoration.mark({ class: "tok-env-name" });
const envNameStaged = Decoration.mark({ class: "tok-env-name-staged" });
const envPunctuation = Decoration.mark({ class: "tok-env-punct" });
const namePattern = /^([-._A-Za-z0-9]+)(=)/;

// Marks the NAME= prefix of every line; references inside the value are
// decorated by the shared reference language.
function envLineHighlighter(isStaged: TIsStaged) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, isStaged);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view, isStaged);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function build(view: EditorView, isStaged: TIsStaged) {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    let position = from;
    while (position <= to) {
      const line = view.state.doc.lineAt(position);
      const match = namePattern.exec(line.text);
      if (match) {
        const nameEnd = line.from + match[1].length;
        builder.add(line.from, nameEnd, isStaged(match[1]) ? envNameStaged : envName);
        builder.add(nameEnd, nameEnd + 1, envPunctuation);
      }
      position = line.to + 1;
    }
  }
  return builder.finish();
}

// The language is rebuilt when the staged set changes, which is what re-colors
// names after a save without the text changing.
export function createEnvVariablesLanguage<T>(getData: () => TEnvVariablesData<T>) {
  return createVariableReferenceLanguage(getData, [
    envLineHighlighter((name) => getData().stagedNames.has(name)),
  ]);
}
