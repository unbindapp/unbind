import ErrorLine from "@/components/error-line";
import { useVariables } from "@/components/variables/variables-provider";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { getVariablesFromRawText } from "@/components/variables/helpers";
import { defaultAnimationMs } from "@/lib/constants";
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import useTemporaryValue from "@/lib/hooks/use-temporary-value";
import { TVariableShallow, VariableForCreateSchema } from "@/server/trpc/api/variables/types";
import { useMutation } from "@tanstack/react-query";
import { CheckCircleIcon, CheckIcon, CopyIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import Prism, { highlight } from "prismjs";
import "prismjs/components/prism-ini";
import { ReactNode, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import { toast } from "sonner";
import { z } from "zod";

type TProps = {
  children: ReactNode;
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

  const variables = variablesData?.variables;
  const [editorValue, setEditorValue] = useState(variables ? getEditorValue({ variables }) : "");

  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [recentlySucceeded, setRecentlySucceeded] = useTemporaryValue({
    defaultValue: false,
    ttl: 3000,
  });

  const resetEditorValue = () => {
    setEditorValue(variables ? getEditorValue({ variables }) : "");
  };

  useEffect(() => {
    if (!variables) return;
    setEditorValue(getEditorValue({ variables }));
  }, [variables]);

  useEffect(() => {
    if (!variables) return;
    if (!recentlySucceeded) return;
    setEditorValue(getEditorValue({ variables }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentlySucceeded]);

  const {
    mutate: replaceVariables,
    isPending: replaceVariablesIsPending,
    error: replaceVariablesError,
  } = useMutation({
    mutationFn: async () => {
      if (editorValue === null) {
        toast.error("No value", {
          description: "There is no value in the editor",
        });
        return;
      }

      const variables = getVariablesFromRawText(editorValue);
      const parsedVariables: z.infer<typeof VariableForCreateSchema>[] = [];

      for (const variable of variables) {
        const res = VariableForCreateSchema.safeParse(variable);
        if (!res.success) {
          console.error("Invalid variable", res.error);
          throw new Error(`Invalid variable "${variable.name}": ${res.error.errors[0].message}`);
        }
        parsedVariables.push({ name: res.data.name, value: res.data.value });
      }

      await createOrUpdateVariables({
        ...typedProps,
        behavior: "overwrite",
        variables: parsedVariables,
        variableReferences: undefined,
      });
    },
    mutationKey: ["replace-variables"],
    onSuccess: async () => {
      const refetchRes = await ResultAsync.fromPromise(
        refetchVariables(),
        () => new Error("Failed to refetch variables"),
      );
      if (refetchRes.isErr()) {
        toast.error("Failed to refetch variables", {
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
            resetEditorValue();
          }, defaultAnimationMs);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        hideXButton
        className="h-[calc(var(--safe-screen-height)-var(--dialog-top-padding)-var(--dialog-bottom-padding))] max-h-200 min-h-72 sm:h-[calc(var(--safe-screen-height)-var(--dialog-bottom-padding)-var(--dialog-bottom-padding-sm))] sm:max-h-160"
        classNameInnerWrapper="w-200 max-w-full h-full"
      >
        <DialogHeader className="sm:px-1">
          <DialogTitle>Raw Editor</DialogTitle>
          <div className="flex w-full items-end justify-between gap-2">
            <DialogDescription className="min-w-0 shrink">
              Add, edit, or remove variables.
            </DialogDescription>
            <CopyButton editorValue={editorValue} className="-my-2.5 -mr-3.5 sm:-mr-1.5" />
          </div>
        </DialogHeader>
        <VariableEditorOrPlaceholder
          variables={variables}
          recentlySucceeded={recentlySucceeded}
          editorValue={editorValue}
          onEditorValueChange={setEditorValue}
        />
        {error && <ErrorLine message={error.message} />}
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <DialogClose asChild className="text-muted-foreground">
            <Button type="button" variant="ghost">
              Close
            </Button>
          </DialogClose>
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

function VariableEditorOrPlaceholder({
  variables,
  editorValue,
  onEditorValueChange,
  recentlySucceeded,
}: Omit<TVariableEditorProps, "variables"> & { variables?: TVariableShallow[] }) {
  if (variables) {
    return (
      <VariableEditor
        variables={variables}
        editorValue={editorValue}
        onEditorValueChange={onEditorValueChange}
        recentlySucceeded={recentlySucceeded}
      />
    );
  }
  return (
    <div
      style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10 }}
      className="bg-background-hover flex flex-1 flex-col gap-1 overflow-hidden rounded-lg border font-mono"
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="pointer-events-none flex w-full items-center gap-1 text-transparent select-none"
        >
          <span className="bg-foreground animate-skeleton flex-1 rounded-md leading-tight">N</span>
          <span className="bg-muted-more-foreground animate-skeleton flex-[2] rounded-md leading-tight">
            V
          </span>
        </div>
      ))}
    </div>
  );
}

type TVariableEditorProps = {
  variables: TVariableShallow[];
  recentlySucceeded: boolean;
  onEditorValueChange: (s: string) => void;
  editorValue: string;
};

function VariableEditor({
  variables,
  recentlySucceeded,
  editorValue,
  onEditorValueChange,
}: TVariableEditorProps) {
  const [hiddenValue, setHiddenValue] = useState(getEditorValue({ variables, hidden: true }));
  const [isHidden, setIsHidden] = useState(true);

  useEffect(() => {
    if (variables) setHiddenValue(getEditorValue({ variables, hidden: true }));
  }, [variables]);

  return (
    <div className="relative -mx-3 flex w-[calc(100%+1.5rem)] flex-1 flex-col overflow-hidden sm:mx-0 sm:w-full">
      <ScrollArea
        viewportClassName="[&>div]:group-data-[orientation=vertical]/root:flex-1"
        className="bg-background-hover flex flex-1 flex-col overflow-auto rounded-lg border font-mono"
      >
        <div className="flex w-full flex-1 flex-col">
          <Editor
            placeholder="VARIABLE_NAME=Value"
            padding={{ left: 14, right: 14, top: 10, bottom: 10 }}
            value={isHidden ? hiddenValue : editorValue}
            onValueChange={onEditorValueChange}
            className="flex-1"
            onFocus={() => setIsHidden(false)}
            highlight={(v) => highlight(v, Prism.languages.ini, "ini")}
          />
        </div>
      </ScrollArea>
      <div className="pointer-events-none absolute right-0 bottom-0 z-10 flex w-full overflow-hidden rounded-b-xl">
        <div
          data-open={recentlySucceeded ? true : undefined}
          className="group/badge bg-background/80 flex w-full translate-y-full items-end justify-end rounded-b-xl opacity-0 transition duration-200 data-open:translate-y-0 data-open:opacity-100"
        >
          <div className="bg-success/20 border-success/20 flex w-full items-end justify-end rounded-b-xl border-t p-2 sm:p-3">
            <div className="text-success-foreground bg-success flex max-w-full items-center gap-1.5 overflow-hidden rounded-md px-2.5 py-1 font-sans font-bold">
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
  hidden,
}: {
  variables: TVariableShallow[];
  hidden?: boolean;
}) {
  return variables
    .map((variable) => `${variable.name}=${hidden ? "••••••••••" : variable.value}`)
    .join("\n");
}

function CopyButton({
  editorValue,
  className,
}: {
  editorValue: string | null;
  className?: string;
}) {
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();
  return (
    <Button
      data-copied={isRecentlyCopied ? true : undefined}
      onClick={() => (editorValue !== null ? copyToClipboard(editorValue) : null)}
      variant="ghost"
      forceMinSize="medium"
      size="icon"
      className={cn("text-muted-foreground group/button rounded-lg", className)}
      fadeOnDisabled={false}
    >
      <div className="relative size-4.5 transition-transform group-data-copied/button:rotate-90">
        <CopyIcon className="group-data-copied/button:text-success size-full transition-opacity group-data-copied/button:opacity-0" />
        <CheckIcon
          strokeWidth={3}
          className="group-data-copied/button:text-success absolute top-0 left-0 size-full -rotate-90 opacity-0 transition-opacity group-data-copied/button:opacity-100"
        />
      </div>
    </Button>
  );
}
