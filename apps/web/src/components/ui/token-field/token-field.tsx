import {
  tokenFieldAutocomplete,
  type TCompletionAddition,
} from "@/components/ui/token-field/autocomplete";
import { tokenFieldHighlightStyle, tokenFieldTheme } from "@/components/ui/token-field/theme";
import {
  tokenFieldEditorClassName,
  tokenFieldWrapperClassName,
} from "@/components/ui/token-field/styles";
import { cn } from "@/components/ui/utils";
import { history, historyKeymap, standardKeymap } from "@codemirror/commands";
import { type LanguageSupport, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { startCompletion } from "@codemirror/autocomplete";
import { EditorView, keymap, placeholder as placeholderExt, tooltips } from "@codemirror/view";
import { useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";

/** Where a trigger button's text goes. An empty insert leaves the doc alone. */
export type TTokenFieldInsertion = { from: number; to: number; insert: string };

export type TTokenFieldHandle = {
  focus: () => void;
  /**
   * Writes what the resolver picks for the cursor and opens the dropdown, for
   * trigger buttons. The write is what leaves the field in a state the
   * completion source recognises, so typing on from there keeps filtering.
   */
  insertAndComplete: (resolve: (doc: string, pos: number) => TTokenFieldInsertion) => void;
};

export type TTokenFieldProps = {
  value: string;
  onChange: (value: string) => void;
  /** Omitted for a plain field with no highlighting or completion. */
  language?: LanguageSupport;
  onSubmit?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  multiline?: boolean;
  /** Extra DOM injected into each completion option, e.g. an icon. */
  completionAdditions?: TCompletionAddition[];
  /** Stretches the dropdown to the field's width on every viewport, not just phones. */
  anchorDropdownToField?: boolean;
  /**
   * Opens the dropdown right under the caret's line instead of clearing the
   * whole field box. For tall editors, where clearing the box would push the
   * dropdown to the bottom of the editor.
   */
  dropdownAtCaret?: boolean;
  ariaLabel?: string;
  ariaInvalid?: boolean;
  /** Softer than invalid: the field is usable but its value isn't being applied. */
  warning?: boolean;
  disabled?: boolean;
  /** Rendered inside the field box, after the editor. */
  trailing?: ReactNode;
  className?: string;
  classNameEditor?: string;
  ref?: Ref<TTokenFieldHandle>;
};

// Matches the sideOffset our Popover and DropdownMenu use.
const anchorGap = 4;

// Pasting multiple lines into a one-line field flattens instead of being dropped.
const singleLineFilter = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  if (tr.newDoc.lines <= 1) return tr;

  const flattened = tr.newDoc.toString().replace(/\s*\r?\n\s*/g, " ");
  return {
    changes: { from: 0, to: tr.startState.doc.length, insert: flattened },
    selection: { anchor: Math.min(tr.newSelection.main.head, flattened.length) },
  };
});

export default function TokenField({
  value,
  onChange,
  language,
  onSubmit,
  onBlur,
  onFocus,
  placeholder,
  multiline,
  completionAdditions,
  anchorDropdownToField,
  dropdownAtCaret,
  ariaLabel,
  ariaInvalid,
  warning,
  disabled,
  trailing,
  className,
  classNameEditor,
  ref,
}: TTokenFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const editableCompartment = useRef(new Compartment());

  // Latest values without re-creating the editor on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  // Static config, read once: reacting to it would rebuild the whole editor.
  const completionAdditionsRef = useRef(completionAdditions);
  const anchorDropdownToFieldRef = useRef(anchorDropdownToField);
  const dropdownAtCaretRef = useRef(dropdownAtCaret);
  // Tracks the value both sides agree on, so neither direction echoes the other.
  const syncedValueRef = useRef(value);

  // The dropdown renders in the body, so it can't inherit the field's width.
  // Publishing the focused field's insets lets the mobile CSS line the two up.
  const publishAnchorInsets = () => {
    const element = wrapperRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const style = document.documentElement.style;
    style.setProperty("--token-field-anchor-left", `${Math.round(rect.left)}px`);
    style.setProperty(
      "--token-field-anchor-right",
      `${Math.round(window.innerWidth - rect.right)}px`,
    );

    // CodeMirror anchors the dropdown to the caret's line, so it lands inside
    // the field. These are the extra offsets needed to clear the whole box,
    // expressed as margins so they hold whether the tooltip is positioned
    // fixed (desktop) or absolute (iOS).
    const view = viewRef.current;
    const caret = dropdownAtCaretRef.current
      ? null
      : view?.coordsAtPos(view.state.selection.main.head);
    style.setProperty(
      "--token-field-anchor-gap-below",
      `${Math.round(caret ? rect.bottom - caret.bottom + anchorGap : anchorGap)}px`,
    );
    style.setProperty(
      "--token-field-anchor-gap-above",
      `${Math.round(caret ? -(caret.top - rect.top + anchorGap) : -anchorGap)}px`,
    );
  };

  useImperativeHandle(
    ref,
    () => ({
      focus: () => viewRef.current?.focus(),
      insertAndComplete: (resolve) => {
        const view = viewRef.current;
        if (!view) return;
        const at = view.state.selection.main.head;
        const { from, to, insert } = resolve(view.state.doc.toString(), at);
        if (insert !== view.state.sliceDoc(from, to)) {
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length },
            // typed, as far as the completion source is concerned
            userEvent: "input.type",
          });
        }
        view.focus();
        startCompletion(view);
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const extensions: Extension[] = [
      history(),
      keymap.of([
        ...(multiline
          ? []
          : [
              {
                key: "Enter",
                run: () => {
                  onSubmitRef.current?.();
                  return true;
                },
              },
            ]),
        ...historyKeymap,
        ...standardKeymap,
      ]),
      languageCompartment.current.of(language ?? []),
      editableCompartment.current.of(EditorView.editable.of(!disabled)),
      syntaxHighlighting(tokenFieldHighlightStyle),
      tokenFieldAutocomplete(completionAdditionsRef.current, anchorDropdownToFieldRef.current),
      // CodeMirror falls back to absolute tooltip positioning on iOS, where an
      // ancestor's overflow:hidden then clips the dropdown. Rendering into the
      // body escapes every clipping ancestor.
      tooltips({ parent: document.body }),
      tokenFieldTheme,
      EditorView.contentAttributes.of({
        spellcheck: "false",
        autocorrect: "off",
        autocapitalize: "off",
        enterkeyhint: multiline ? "enter" : "search",
        ...(ariaLabel ? { "aria-label": ariaLabel } : {}),
      }),
      EditorView.domEventHandlers({
        blur: () => {
          onBlurRef.current?.();
          return false;
        },
        focus: () => {
          onFocusRef.current?.();
          return false;
        },
      }),
      EditorView.updateListener.of((update) => {
        if (
          update.focusChanged ||
          update.geometryChanged ||
          update.docChanged ||
          update.selectionSet
        ) {
          publishAnchorInsets();
        }
        if (!update.docChanged) return;
        const next = update.state.doc.toString();
        if (next === syncedValueRef.current) return;
        syncedValueRef.current = next;
        onChangeRef.current(next);
      }),
      ...(multiline ? [EditorView.lineWrapping] : [singleLineFilter]),
    ];

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: placeholder ? [...extensions, placeholderExt(placeholder)] : extensions,
      }),
      parent: host,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once; live updates flow through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiline, placeholder, ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: languageCompartment.current.reconfigure(language ?? []) });
  }, [language]);

  // Adopt writes that came from outside the field (navigation, reset, clear).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === syncedValueRef.current) return;
    syncedValueRef.current = value;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      selection: { anchor: Math.min(view.state.selection.main.anchor, value.length) },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.current.reconfigure(EditorView.editable.of(!disabled)),
    });
  }, [disabled]);

  return (
    <div
      ref={wrapperRef}
      data-disabled={disabled || undefined}
      data-warning={warning || undefined}
      aria-invalid={ariaInvalid || undefined}
      className={cn(tokenFieldWrapperClassName, className)}
    >
      <div ref={hostRef} className={cn(tokenFieldEditorClassName, classNameEditor)} />
      {trailing}
    </div>
  );
}
