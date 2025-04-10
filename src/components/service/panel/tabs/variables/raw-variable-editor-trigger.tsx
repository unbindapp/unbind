import ErrorLine from "@/components/error-line";
import { useVariables } from "@/components/service/panel/tabs/variables/variables-provider";
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
import { useCopyToClipboard } from "@/lib/hooks/use-copy";
import useTemporaryValue from "@/lib/hooks/use-temporary-value";
import { TVariableShallow, VariableForCreateSchema } from "@/server/trpc/api/variables/types";
import { useMutation } from "@tanstack/react-query";
import { CheckCircleIcon, CheckIcon, CopyIcon } from "lucide-react";
import { ResultAsync } from "neverthrow";
import Prism, { highlight } from "prismjs";
import "prismjs/components/prism-ini";
import { ReactNode, RefObject, useEffect, useRef, useState } from "react";
import Editor from "react-simple-code-editor";
import { toast } from "sonner";
import { z } from "zod";

type TProps = {
  children: ReactNode;
};

export default function RawVariableEditorTrigger({ children }: TProps) {
  const {
    teamId,
    projectId,
    environmentId,
    serviceId,
    list: { data: variablesData, error: variablesError, isPending: variablesIsPending },
    update: { mutateAsync: overwriteVariables },
    utils: { refetch: refetchVariables },
  } = useVariables();

  const variables = variablesData?.variables;
  const editorValue = useRef<string | null>(null);

  const [recentlySucceeded, setRecentlySucceeded] = useTemporaryValue({
    defaultValue: false,
    ttl: 3000,
  });

  const {
    mutate: replaceVariables,
    isPending: replaceVariablesIsPending,
    error: replaceVariablesError,
  } = useMutation({
    mutationFn: async () => {
      if (editorValue.current === null) {
        toast.error("No value", {
          description: "There is no value in the editor",
        });
        return;
      }
      const cleaned = editorValue.current.trim();
      const lines = cleaned.split("\n");
      const pairs = lines.map((line) => {
        const [name, value] = line.split("=");
        return { name, value };
      });
      const parsedVariables: z.infer<typeof VariableForCreateSchema>[] = [];
      for (const pair of pairs) {
        const res = VariableForCreateSchema.safeParse(pair);
        if (!res.success) {
          console.error("Invalid variable", res.error);
          throw new Error(`Invalid variable "${pair.name}": ${res.error.errors[0].message}`);
        }
        parsedVariables.push({ name: res.data.name, value: res.data.value });
      }
      await overwriteVariables({
        type: "service",
        behavior: "overwrite",
        teamId,
        projectId,
        environmentId,
        serviceId,
        variables: parsedVariables,
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
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        hideXButton
        classNameInnerWrapper="w-160 max-w-full h-140 min-h-64 max-h-[60svh]"
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
        {variables ? (
          <VariableEditor
            variables={variables}
            editorValue={editorValue}
            recentlySucceeded={recentlySucceeded}
          />
        ) : (
          <div
            style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10 }}
            className="bg-background-hover flex flex-1 flex-col gap-1 overflow-hidden rounded-lg border font-mono"
          >
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="pointer-events-none flex w-full items-center gap-1 text-transparent select-none"
              >
                <span className="bg-foreground animate-skeleton flex-1 rounded-md leading-tight">
                  N
                </span>
                <span className="bg-muted-more-foreground animate-skeleton flex-[2] rounded-md leading-tight">
                  V
                </span>
              </div>
            ))}
          </div>
        )}
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

function VariableEditor({
  variables,
  editorValue,
  recentlySucceeded,
}: {
  variables: TVariableShallow[];
  editorValue: RefObject<string | null>;
  recentlySucceeded: boolean;
}) {
  const [value, setValue] = useState(getEditorValue(variables));

  useEffect(() => {
    editorValue.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative -mx-3 flex w-[calc(100%+1.5rem)] flex-1 flex-col overflow-hidden sm:mx-0 sm:w-full">
      <ScrollArea className="bg-background-hover flex-1 overflow-auto rounded-lg border font-mono">
        <Editor
          padding={{ left: 14, right: 14, top: 10, bottom: 10 }}
          value={value}
          onValueChange={(v) => setValue(v)}
          highlight={(v) => highlight(v, Prism.languages.ini, "ini")}
        />
      </ScrollArea>
      <div
        data-open={recentlySucceeded ? true : undefined}
        className="bg-success text-success-foreground shadow-shadow/shadow pointer-events-none absolute right-3 bottom-3 flex max-w-full translate-y-[calc(100%+0.75rem)] items-center gap-1.25 rounded-full px-2.5 py-0.5 font-sans text-sm font-bold opacity-0 shadow-md transition data-open:translate-y-0 data-open:opacity-100"
      >
        <CheckCircleIcon className="-ml-1 size-4" strokeWidth={2.5} />
        <p className="min-w-0 shrink">Updated</p>
      </div>
    </div>
  );
}

function getEditorValue(variables: TVariableShallow[]) {
  return variables.map((variable) => `${variable.name}=${variable.value}`).join("\n");
}

function CopyButton({
  editorValue,
  className,
}: {
  editorValue: RefObject<string | null>;
  className?: string;
}) {
  const { copyToClipboard, isRecentlyCopied } = useCopyToClipboard();
  return (
    <Button
      data-copied={isRecentlyCopied ? true : undefined}
      onClick={() => (editorValue.current !== null ? copyToClipboard(editorValue.current) : null)}
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
