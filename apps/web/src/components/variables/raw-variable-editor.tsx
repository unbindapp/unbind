import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import { IconCache } from "@/components/icons/icon-cache";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import TokenField from "@/components/ui/token-field/token-field";
import {
  getVariablesFromRawText,
  referenceMapForVariables,
  toReadableValue,
  toStoredValue,
} from "@/components/variables/helpers";
import { readableTokenMap } from "@/components/variables/tokens";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import {
  referenceCompletionAdditions,
  useVariableReferenceLanguage,
} from "@/components/variables/variables-form-field";
import { useVariables } from "@/components/variables/variables-provider";
import { defaultAnimationMs } from "@/lib/constants";
import useTemporaryValue from "@/lib/hooks/use-temporary-value";
import {
  TVariableForCreate,
  TVariableShallow,
  VariableForCreateSchema,
} from "@/lib/queries/variables";
import { CheckCircleIcon } from "lucide-react";
import { ReactElement, useEffect, useMemo, useRef, useState } from "react";

type TProps = {
  children: ReactElement;
};

export default function RawVariableEditor({ children }: TProps) {
  const {
    list: { data: variablesData, error: variablesError, isPending: variablesIsPending },
    variables: mergedVariables,
    stage,
    ...typedProps
  } = useVariables();
  const { tokens } = useVariableReferences();

  // The editor shows the staged state, saving diffs against what the server has
  const variables = useMemo(
    () => mergedVariables?.filter((v) => v.staged !== "deleted"),
    [mergedVariables],
  );
  const serverVariables = variablesData?.variables;
  const editorText = useMemo(
    () => (variables ? getEditorValue({ variables, tokens }) : ""),
    [variables, tokens],
  );
  const [editorValue, setEditorValue] = useState(editorText);

  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [recentlySucceeded, setRecentlySucceeded] = useTemporaryValue({
    defaultValue: false,
    ttl: 3000,
  });
  const replayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // If the banner is already up, drop it briefly so it visibly plays again
  const showSucceeded = () => {
    if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);
    setRecentlySucceeded((alreadyShowing) => {
      if (!alreadyShowing) return true;
      replayTimeoutRef.current = setTimeout(() => {
        setRecentlySucceeded(true);
        replayTimeoutRef.current = null;
      }, 150);
      return false;
    });
  };

  useEffect(() => {
    return () => {
      if (replayTimeoutRef.current) clearTimeout(replayTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!variables) return;
    setEditorValue(editorText);
  }, [variables, editorText]);

  useEffect(() => {
    if (!variables) return;
    if (!recentlySucceeded) return;
    setEditorValue(editorText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentlySucceeded]);

  const [parseError, setParseError] = useState<Error | null>(null);

  // Parsing and the no-change check happen before staging so an unchanged save
  // never touches the store.
  const save = () => {
    if (!variables || !serverVariables) return;
    if (!tokens) {
      toast.add({
        type: "warning",
        title: "Variable references unavailable",
        description: "Variable references are not available yet, please try again later.",
      });
      return;
    }

    const referencesByValue = referenceMapForVariables(tokens, variables);
    const parsedVariables: TVariableForCreate[] = [];
    for (const variable of getVariablesFromRawText(editorValue)) {
      const res = VariableForCreateSchema.safeParse(variable);
      if (!res.success) {
        setParseError(
          new Error(`Invalid variable "${variable.name}": ${res.error.errors[0].message}`),
        );
        return;
      }
      parsedVariables.push({
        name: res.data.name,
        value: toStoredValue(res.data.value, referencesByValue),
      });
    }
    setParseError(null);

    const current = new Map(variables.map((v) => [v.name, v.value]));
    const changed =
      parsedVariables.length !== current.size ||
      parsedVariables.some((v) => current.get(v.name) !== v.value);
    if (!changed) {
      showSucceeded();
      return;
    }

    // Everything the text no longer mentions gets removed, so the editor stays a full picture
    const parsedByName = new Map(parsedVariables.map((v) => [v.name, v.value]));
    const names = new Set([...variables.map((v) => v.name), ...parsedByName.keys()]);
    stage([...names].map((name) => ({ name, value: parsedByName.get(name) ?? null })));
    showSucceeded();
  };

  const isPending = variablesIsPending;
  const error = variablesError || parseError;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setEditorValue(editorText);
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger render={children} />
      <DialogContent
        hideXButton
        avoidKeyboard
        className="h-[calc(var(--safe-screen-height-keyboard)-var(--dialog-top-padding)-var(--dialog-bottom-padding))] max-h-200 min-h-72 sm:h-[calc(var(--safe-screen-height-keyboard)-var(--dialog-top-padding-sm)-var(--dialog-bottom-padding-sm))]"
        classNameInnerWrapper="w-200 max-w-full h-full"
      >
        <DialogHeader className="sm:px-1">
          <DialogTitle>Raw Editor</DialogTitle>
          <div className="flex w-full items-end justify-between gap-2">
            <DialogDescription className="min-w-0 shrink">
              Add, edit, or remove variables.
            </DialogDescription>
            <CopyButton
              valueToCopy={editorValue}
              className="text-muted-foreground -my-2.5 -mr-3.5 rounded-lg sm:-mr-1.5"
            />
          </div>
        </DialogHeader>
        {variables ? (
          <VariableEditor
            variables={variables}
            referencesDisabled={typedProps.type !== "service"}
            recentlySucceeded={recentlySucceeded}
            editorValue={editorValue}
            onEditorValueChange={setEditorValue}
          />
        ) : (
          <EditorSkeleton />
        )}
        {error && <ErrorLine message={error.message} />}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose
            className="text-muted-foreground"
            render={
              <Button type="button" variant="ghost">
                Close
              </Button>
            }
          />
          <Button
            disabled={isPending || variables === undefined}
            isPending={isPending}
            onClick={save}
            className="group/button"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditorSkeleton() {
  return (
    <div className="bg-card flex flex-1 flex-col gap-1 overflow-hidden rounded-lg border px-3.5 py-2.5 font-mono">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="pointer-events-none flex w-full items-center gap-1 text-transparent select-none"
        >
          <span className="bg-foreground animate-skeleton flex-1 rounded-md leading-tight">N</span>
          <span className="bg-muted-more-foreground animate-skeleton flex-2 rounded-md leading-tight">
            V
          </span>
        </div>
      ))}
    </div>
  );
}

type TVariableEditorProps = {
  variables: TVariableShallow[];
  referencesDisabled: boolean;
  recentlySucceeded: boolean;
  onEditorValueChange: (s: string) => void;
  editorValue: string;
};

function VariableEditor({
  variables,
  referencesDisabled,
  recentlySucceeded,
  editorValue,
  onEditorValueChange,
}: TVariableEditorProps) {
  const { tokens } = useVariableReferences();
  // Scopes without references keep the NAME= highlighting; an empty token
  // list means nothing gets chipped and the dropdown has nothing to offer.
  const { language, icons } = useVariableReferenceLanguage(referencesDisabled ? [] : tokens, "env");
  const hiddenValue = useMemo(() => getEditorValue({ variables, hidden: true }), [variables]);
  // Values stay masked until the editor is focused
  const [isHidden, setIsHidden] = useState(true);

  return (
    <div className="relative -mx-3 flex min-h-0 w-[calc(100%+1.5rem)] flex-1 flex-col sm:mx-0 sm:w-full">
      {!referencesDisabled && <IconCache icons={icons} />}
      <TokenField
        value={isHidden ? hiddenValue : editorValue}
        onChange={onEditorValueChange}
        onFocus={() => setIsHidden(false)}
        language={language}
        completionAdditions={referencesDisabled ? undefined : referenceCompletionAdditions}
        multiline
        dropdownAtCaret
        placeholder="VARIABLE_NAME=Value"
        // Pinned to the field's box so the editor fills the dialog's flex space and scrolls
        className="bg-card relative min-h-0 flex-1 overflow-hidden rounded-lg"
        classNameEditor="absolute inset-0 w-auto [--token-field-content-padding:0.625rem_0.875rem] font-mono font-normal"
      />
      <div className="pointer-events-none absolute right-0 bottom-0 z-10 flex w-full overflow-hidden rounded-b-lg">
        <div
          data-open={recentlySucceeded || undefined}
          className="group/badge bg-card text-success border-success/20 flex w-full translate-y-full items-center justify-start gap-2 overflow-hidden rounded-b-lg border px-4 py-2.5 font-medium opacity-0 transition data-open:translate-y-0 data-open:opacity-100"
        >
          <div className="bg-success/10 absolute top-0 left-0 h-full w-full" />
          <CheckCircleIcon className="relative -ml-0.5 size-4.5" strokeWidth={2.5} />
          <p className="relative min-w-0 shrink">Variables staged</p>
        </div>
      </div>
    </div>
  );
}

function getEditorValue({
  variables,
  tokens,
  hidden,
}: {
  variables: TVariableShallow[];
  tokens?: Parameters<typeof readableTokenMap>[0];
  hidden?: boolean;
}) {
  const storedToReadable = readableTokenMap(tokens ?? []);
  return variables
    .map((variable) => {
      if (hidden) return `${variable.name}=••••••••••`;
      return `${variable.name}=${toReadableValue(variable.value, variable.references, storedToReadable)}`;
    })
    .join("\n");
}
