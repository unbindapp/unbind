import { envAssignments, envVariableNameAt } from "@/components/variables/helpers";
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

// Marks the NAME= prefix of every variable; references inside the value are
// decorated by the shared reference language.
function envLineHighlighter(isStaged: TIsStaged) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, isStaged);
      }
      update(update: ViewUpdate) {
        if (!update.docChanged) return;
        this.decorations = build(update.view, isStaged);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

function build(view: EditorView, isStaged: TIsStaged) {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { name, from } of envAssignments(view.state.doc.toString())) {
    const nameEnd = from + name.length;
    builder.add(from, nameEnd, isStaged(name) ? envNameStaged : envName);
    builder.add(nameEnd, nameEnd + 1, envPunctuation);
  }
  return builder.finish();
}

// The language is rebuilt when the staged set changes, which is what re-colors
// names after a save without the text changing.
export function createEnvVariablesLanguage<T>(getData: () => TEnvVariablesData<T>) {
  return createVariableReferenceLanguage(
    () => ({ ...getData(), variableNameAt: envVariableNameAt }),
    [envLineHighlighter((name) => getData().stagedNames.has(name))],
  );
}
