import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import { IconCache } from "@/components/icons/icon-cache";
import { useTemporarilyAddNewEntity } from "@/components/stores/main/main-store-provider";
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
import {
  getVariablesFromRawText,
  referenceMapForVariables,
  toReadableValue,
  toStoredValue,
} from "@/components/variables/helpers";
import { readableTokenMap } from "@/components/variables/tokens";
import { getNewEntityIdForVariable } from "@/components/variables/variable-card";
import { useVariableReferences } from "@/components/variables/variable-references-provider";
import {
  referenceCompletionAdditions,
  useVariableReferenceLanguage,
} from "@/components/variables/variables-form-field";
import { useVariables } from "@/components/variables/variables-provider";
import { defaultAnimationMs } from "@/lib/constants";
import useTemporaryValue from "@/lib/hooks/use-temporary-value";
import { TVariableShallow, VariableForCreateSchema } from "@/lib/queries/variables";
import { useMutation } from "@tanstack/react-query";
import { CheckCircleIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import { lazy, ReactElement, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/toast";
import { z } from "zod";

const TokenFieldLazy = lazy(() => import("@/components/ui/token-field/token-field"));

type TProps = {
  children: ReactElement;
};

export default function RawVariableEditor({ children }: TProps) {
  const {
    list: {
      data: variablesData,
      error: variablesError,
      isPending: variablesIsPending,
      refetch: refetchVariables,
    },
    createOrUpdate: { mutateAsync: createOrUpdateVariables },
    ...typedProps
  } = useVariables();
  const { tokens } = useVariableReferences();

  const variables = variablesData?.variables;
  const editorText = useMemo(
    () => (variables ? getEditorValue({ variables, tokens }) : ""),
    [variables, tokens],
  );
  const [editorValue, setEditorValue] = useState(editorText);

  const temporarilyAddNewEntity = useTemporarilyAddNewEntity();

  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [recentlySucceeded, setRecentlySucceeded] = useTemporaryValue({
    defaultValue: false,
    ttl: 3000,
  });

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

  const {
    mutate: replaceVariables,
    isPending: replaceVariablesIsPending,
    error: replaceVariablesError,
  } = useMutation({
    mutationFn: async () => {
      if (!variables) return;
      if (!tokens) {
        toast.add({
          type: "warning",
          title: "Variable references unavailable",
          description: "Variable references are not available yet, please try again later.",
        });
        return;
      }

      const referencesByValue = referenceMapForVariables(tokens, variables);
      const parsedVariables: z.infer<typeof VariableForCreateSchema>[] = [];

      for (const variable of getVariablesFromRawText(editorValue)) {
        const res = VariableForCreateSchema.safeParse(variable);
        if (!res.success) {
          console.error("Invalid variable", res.error);
          throw new Error(`Invalid variable "${variable.name}": ${res.error.errors[0].message}`);
        }
        parsedVariables.push({
          name: res.data.name,
          value: toStoredValue(res.data.value, referencesByValue),
        });
      }

      await createOrUpdateVariables({
        ...typedProps,
        behavior: "overwrite",
        variables: parsedVariables,
      });

      for (const i of parsedVariables) {
        const id = getNewEntityIdForVariable({ name: i.name, value: i.value });
        temporarilyAddNewEntity(id);
      }
    },
    mutationKey: ["replace-variables"],
    onSuccess: async () => {
      const refetchRes = await ResultAsync.fromPromise(
        refetchVariables(),
        () => new Error("Failed to refetch variables"),
      );
      if (refetchRes.isErr()) {
        toast.add({
          type: "error",
          title: "Failed to refetch variables",
          description: refetchRes.error.message,
        });
        return;
      }
      setRecentlySucceeded(true);
    },
  });

  const isPending = variablesIsPending || replaceVariablesIsPending;
  const error = variablesError || replaceVariablesError;

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
            onClick={() => replaceVariables()}
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
      <Suspense fallback={<EditorSkeleton />}>
        <TokenFieldLazy
          value={isHidden ? hiddenValue : editorValue}
          onChange={onEditorValueChange}
          onFocus={() => setIsHidden(false)}
          language={language}
          completionAdditions={referencesDisabled ? undefined : referenceCompletionAdditions}
          multiline
          dropdownAtCaret
          placeholder="VARIABLE_NAME=Value"
          fill
          // The host is pinned to the field's box so CodeMirror has a definite
          // height to fill: the editor spans the whole bordered area and scrolls.
          className="bg-card relative min-h-0 flex-1 overflow-hidden rounded-lg"
          classNameEditor="absolute inset-0 w-auto p-0 [--token-field-content-padding:0.625rem_0.875rem] font-mono font-normal"
        />
      </Suspense>
      <div className="pointer-events-none absolute right-0 bottom-0 z-10 flex w-full overflow-hidden rounded-b-xl">
        <div
          data-open={recentlySucceeded || undefined}
          className="group/badge bg-background/80 flex w-full translate-y-full items-end justify-end rounded-b-xl opacity-0 transition duration-200 data-open:translate-y-0 data-open:opacity-100"
        >
          <div className="bg-success/20 border-success/20 flex w-full items-end justify-end rounded-b-xl border-t p-2 sm:p-3">
            <div className="text-success-foreground bg-success flex max-w-full items-center gap-1.5 overflow-hidden rounded-md px-2.5 py-1 font-sans font-semibold">
              <CheckCircleIcon
                className="relative -ml-0.5 size-4.5 -rotate-90 transition delay-50 duration-300 group-data-open/badge:rotate-0"
                strokeWidth={2.5}
              />
              <p className="relative min-w-0 shrink translate-x-full opacity-0 transition delay-50 duration-300 group-data-open/badge:translate-x-0 group-data-open/badge:opacity-100">
                Updated
              </p>
            </div>
          </div>
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
