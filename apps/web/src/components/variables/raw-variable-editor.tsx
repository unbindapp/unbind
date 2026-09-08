import CopyButton from "@/components/copy-button";
import ErrorLine from "@/components/error-line";
import { IconCache } from "@/components/icons/icon-cache";
import { useDeviceSize } from "@/components/providers/device-size-provider";
import { useStagedChangesStore } from "@/components/staged-changes/staged-changes-provider";
import { useMainStore } from "@/components/stores/main/main-store-provider";
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
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/toast";
import TokenField, { type TTokenFieldHandle } from "@/components/ui/token-field/token-field";
import { cn } from "@/components/ui/utils";
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
import { useVariables, type TVariableWithStaged } from "@/components/variables/variables-provider";
import useTemporaryValue from "@/lib/hooks/use-temporary-value";
import {
  TVariableForCreate,
  TVariableShallow,
  VariableForCreateSchema,
} from "@/lib/queries/variables";
import { CheckCircleIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import {
  FC,
  ReactElement,
  ReactNode,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type TProps = {
  children: ReactElement;
};

type TEditorVariant = "drawer" | "dialog";

export default function RawVariableEditor({ children }: TProps) {
  const {
    list: { data: variablesData, error: variablesError, isPending: variablesIsPending },
    variables: mergedVariables,
    stage,
    ...typedProps
  } = useVariables();
  const { tokens } = useVariableReferences();
  const { isExtraSmall } = useDeviceSize();
  const setBarPinnedEdge = useStagedChangesStore((s) => s.setBarPinnedEdge);
  const setBarSlot = useMainStore((s) => s.setStagedChangesBarSlot);

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
  const isDrawerOpen = open && isExtraSmall;
  // Values stay masked until the editor is focused. Lives here so a switch
  // between the drawer and the dialog keeps it.
  const [isHidden, setIsHidden] = useState(true);
  const editorRef = useRef<TTokenFieldHandle>(null);

  // Focus reveals, so hiding also takes the caret out of the editor
  const toggleHidden = () => {
    if (!isHidden) editorRef.current?.blur();
    setIsHidden(!isHidden);
  };

  // The drawer leaves the top of the screen to the staged changes bar, and
  // hands the bar back to its device default (the bottom on phones) on close
  useEffect(() => {
    if (!isDrawerOpen) return;
    setBarPinnedEdge("top");
    return () => {
      setBarPinnedEdge(null);
      setBarSlot(null);
    };
  }, [isDrawerOpen, setBarPinnedEdge, setBarSlot]);

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

  // Edits left behind on close are dropped the next time the editor opens
  const onOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) return;
    setEditorValue(editorText);
    setParseError(null);
    setIsHidden(true);
  };

  const bodyProps = {
    variables,
    referencesDisabled: typedProps.type !== "service",
    recentlySucceeded,
    editorValue,
    onEditorValueChange: setEditorValue,
    isHidden,
    onReveal: () => setIsHidden(false),
    onToggleHidden: toggleHidden,
    editorRef,
    error: variablesError || parseError,
    isPending: variablesIsPending,
    onSave: save,
  };

  if (isExtraSmall) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
        <DrawerTrigger render={children} />
        <DrawerContent
          hasHandle
          keyboardAware={false}
          className="h-[calc(100%-var(--changes-bar-inset-top)-var(--changes-bar-height)-1.3rem)]"
        >
          <EditorBody
            {...bodyProps}
            variant="drawer"
            Title={DrawerTitle}
            Close={DrawerClose}
            className="pb-(--safe-area-inset-bottom)"
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent
        hideXButton
        avoidKeyboard
        layer="below-changes-bar"
        className="h-[calc(var(--safe-screen-height-keyboard)-var(--dialog-top-padding-sm)-var(--dialog-bottom-padding-sm))] max-h-200 min-h-72"
        classNameInnerWrapper="w-216 max-w-full h-full"
      >
        <EditorBody {...bodyProps} variant="dialog" Title={DialogTitle} Close={DialogClose} />
      </DialogContent>
    </Dialog>
  );
}

type TEditorBodyProps = {
  variant: TEditorVariant;
  variables: TVariableWithStaged[] | undefined;
  referencesDisabled: boolean;
  recentlySucceeded: boolean;
  editorValue: string;
  onEditorValueChange: (s: string) => void;
  isHidden: boolean;
  onReveal: () => void;
  onToggleHidden: () => void;
  editorRef: RefObject<TTokenFieldHandle | null>;
  error: Error | null;
  isPending: boolean;
  onSave: () => void;
  className?: string;
  Title: FC<{ className?: string; children: ReactNode }>;
  Close: FC<{ className?: string; render: ReactElement }>;
};

function EditorBody({
  variant,
  variables,
  referencesDisabled,
  recentlySucceeded,
  editorValue,
  onEditorValueChange,
  isHidden,
  onReveal,
  onToggleHidden,
  editorRef,
  error,
  isPending,
  onSave,
  className,
  Title,
  Close,
}: TEditorBodyProps) {
  const isDrawer = variant === "drawer";

  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col", !isDrawer && "gap-4", className)}>
      {isDrawer ? (
        <div className="flex w-full items-center gap-6 border-b px-5 py-3.5">
          <Title className="min-w-0 flex-1 truncate text-xl leading-tight font-semibold">
            Raw Editor
          </Title>
          <div className="-my-2 -mr-3 ml-auto flex shrink-0 items-center gap-1">
            <ToggleValuesButton isHidden={isHidden} onClick={onToggleHidden} />
            <CopyButton valueToCopy={editorValue} className="rounded-lg" />
            <Close
              className="text-muted-more-foreground rounded-lg"
              render={
                <Button type="button" size="icon" variant="ghost" aria-label="Close">
                  <XIcon className="size-5" />
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <DialogHeader className="px-1">
          <Title>Raw Editor</Title>
          <div className="flex w-full items-end justify-between gap-2">
            <DialogDescription className="min-w-0 shrink">
              Add, edit, or remove variables.
            </DialogDescription>
            <div className="-my-2.5 -mr-1.5 flex shrink-0 items-center">
              <ToggleValuesButton
                isHidden={isHidden}
                onClick={onToggleHidden}
                className="text-muted-foreground"
              />
              <CopyButton valueToCopy={editorValue} className="text-muted-foreground rounded-lg" />
            </div>
          </div>
        </DialogHeader>
      )}
      {variables ? (
        <VariableEditor
          variant={variant}
          variables={variables}
          referencesDisabled={referencesDisabled}
          recentlySucceeded={recentlySucceeded}
          editorValue={editorValue}
          onEditorValueChange={onEditorValueChange}
          isHidden={isHidden}
          onReveal={onReveal}
          editorRef={editorRef}
        />
      ) : (
        <EditorSkeleton variant={variant} />
      )}
      {error && !isDrawer && <ErrorLine message={error.message} />}
      <div
        className={cn(
          "flex w-full flex-wrap items-center justify-end gap-2",
          isDrawer && "flex-col items-stretch gap-3.5 border-t p-3.5",
        )}
      >
        {error && isDrawer && <ErrorLine message={error.message} />}
        {!isDrawer && (
          <Close
            className="text-muted-foreground"
            render={
              <Button type="button" variant="ghost">
                Close
              </Button>
            }
          />
        )}
        <Button
          disabled={isPending || variables === undefined}
          isPending={isPending}
          onClick={onSave}
          className={cn("group/button", isDrawer && "w-full")}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function ToggleValuesButton({
  isHidden,
  onClick,
  className,
}: {
  isHidden: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      aria-label={isHidden ? "Show values" : "Hide values"}
      onClick={onClick}
      variant="ghost"
      forceMinSize="medium"
      size="icon"
      className={cn("text-muted-more-foreground rounded-lg sm:rounded-md", className)}
    >
      {isHidden ? <EyeIcon className="size-4.5" /> : <EyeOffIcon className="size-4.5" />}
    </Button>
  );
}

function EditorSkeleton({ variant }: { variant: TEditorVariant }) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-1 overflow-hidden font-mono",
        variant === "drawer" ? "px-5 py-4" : "bg-card rounded-lg border px-3.5 py-2.5",
      )}
    >
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
  variant: TEditorVariant;
  variables: TVariableWithStaged[];
  referencesDisabled: boolean;
  recentlySucceeded: boolean;
  onEditorValueChange: (s: string) => void;
  editorValue: string;
  isHidden: boolean;
  onReveal: () => void;
  editorRef: RefObject<TTokenFieldHandle | null>;
};

function VariableEditor({
  variant,
  variables,
  referencesDisabled,
  recentlySucceeded,
  editorValue,
  onEditorValueChange,
  isHidden,
  onReveal,
  editorRef,
}: TVariableEditorProps) {
  const { tokens } = useVariableReferences();
  // Scopes without references keep the NAME= highlighting; an empty token
  // list means nothing gets chipped and the dropdown has nothing to offer.
  const stagedNames = useMemo(
    () => new Set(variables.filter((v) => v.staged).map((v) => v.name)),
    [variables],
  );
  const { language, icons } = useVariableReferenceLanguage(
    referencesDisabled ? [] : tokens,
    "env",
    stagedNames,
  );
  const hiddenValue = useMemo(() => getEditorValue({ variables, hidden: true }), [variables]);
  const isDrawer = variant === "drawer";

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col">
      {!referencesDisabled && <IconCache icons={icons} />}
      <TokenField
        ref={editorRef}
        value={isHidden ? hiddenValue : editorValue}
        onChange={onEditorValueChange}
        onFocus={onReveal}
        language={language}
        completionAdditions={referencesDisabled ? undefined : referenceCompletionAdditions}
        multiline
        dropdownAtCaret
        placeholder="VARIABLE_NAME=Value"
        // Pinned to the field's box so the editor fills the flex space and scrolls
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden",
          isDrawer ? "bg-card rounded-none border-0 focus-within:ring-0" : "bg-card rounded-lg",
        )}
        // The drawer's editor runs edge to edge, so its padding is the content's own
        classNameEditor="absolute inset-0 w-auto font-mono font-normal [--token-field-content-padding:0.625rem_0.875rem]"
      />
      <div
        className={cn(
          "pointer-events-none absolute right-0 bottom-0 z-10 flex w-full overflow-hidden",
          !isDrawer && "rounded-b-lg",
        )}
      >
        <div
          data-open={recentlySucceeded || undefined}
          className={cn(
            "group/badge bg-card text-success border-success/6-10 flex w-full translate-y-full items-center justify-start gap-2 overflow-hidden border px-4 py-2.5 font-medium opacity-0 transition data-open:translate-y-0 data-open:opacity-100",
            isDrawer ? "border-x-0 border-b-0 px-5" : "rounded-b-lg",
          )}
        >
          <div className="bg-success/3-10 absolute top-0 left-0 h-full w-full" />
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
