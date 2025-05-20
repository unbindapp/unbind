import { useDeviceSize } from "@/components/providers/device-size-provider";
import TemplateDraftPanelContent from "@/components/templates/panel/template-draft-panel-content";
import { useTemplateDraftPanel } from "@/components/templates/panel/template-draft-panel-provider";
import TemplateDraftIcon from "@/components/templates/template-draft-icon";
import { TTemplateDraft } from "@/components/templates/template-draft-store";
import { useTemplateDraftStore } from "@/components/templates/template-draft-store-provider";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import RenameEntityTrigger from "@/components/triggers/rename-entity-trigger";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/components/ui/utils";
import { defaultAnimationMs } from "@/lib/constants";
import { ServiceRenameSchema } from "@/server/trpc/api/services/types";
import { EllipsisVerticalIcon, PenIcon, TrashIcon, XIcon } from "lucide-react";
import { ReactNode, useCallback, useRef, useState } from "react";

type TProps = {
  templateDraft: TTemplateDraft;
  children: ReactNode;
};

export default function TemplateDraftPanel({ templateDraft, children }: TProps) {
  const { closePanel, currentTemplateDraftId, openPanel } = useTemplateDraftPanel();

  const open = currentTemplateDraftId === templateDraft.id;

  const setOpen = (open: boolean) => {
    if (open) {
      openPanel(templateDraft.id);
    } else {
      closePanel();
    }
  };
  const { isExtraSmall } = useDeviceSize();

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      direction={isExtraSmall ? "bottom" : "right"}
      handleOnly={!isExtraSmall}
    >
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent
        hasHandle={isExtraSmall}
        className="flex h-[calc(100%-1.3rem)] w-full flex-col sm:top-0 sm:right-0 sm:my-0 sm:ml-auto sm:h-full sm:w-256 sm:max-w-[calc(100%-4rem)] sm:rounded-l-2xl sm:rounded-r-none"
      >
        <div className="flex w-full items-start justify-start px-5 pt-4 sm:px-8 sm:pt-6">
          <DrawerHeader className="flex min-w-0 flex-1 items-center justify-start p-0">
            <DrawerTitle className="sr-only">{templateDraft.name}</DrawerTitle>
            <TitleButton templateDraft={templateDraft} />
          </DrawerHeader>
          <div className="-mt-2.25 -mr-3 flex items-center justify-end gap-1 sm:-mt-3 sm:-mr-5">
            <ThreeDotButton templateDraft={templateDraft} />
            {!isExtraSmall && (
              <DrawerClose asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-more-foreground shrink-0 rounded-lg"
                >
                  <XIcon className="size-5" />
                </Button>
              </DrawerClose>
            )}
          </div>
        </div>
        {/* Content */}
        <TemplateDraftPanelContent data-vaul-no-drag templateDraft={templateDraft} />
      </DrawerContent>
    </Drawer>
  );
}

function TitleButton({ templateDraft }: { templateDraft: TTemplateDraft }) {
  const updateTemplateDraft = useTemplateDraftStore((s) => s.update);

  return (
    <RenameEntityTrigger
      type="name-and-description"
      nameInputTitle="Group Name"
      descriptionInputTitle="Group Description"
      name={templateDraft.name}
      description={templateDraft.description || ""}
      dialogTitle="Rename Group"
      dialogDescription="Give a new name and description to the group."
      formSchema={ServiceRenameSchema}
      error={null}
      onSubmit={async (value) => {
        await updateTemplateDraft(templateDraft.id, {
          name: value.name,
          description: value.description,
        });
      }}
    >
      <Button
        variant="ghost"
        className="group/button -my-1 -ml-2.5 flex min-w-0 shrink items-center justify-start gap-2 px-2.5 py-1"
      >
        <TemplateDraftIcon
          templateDraft={templateDraft}
          color="brand"
          className="-ml-1 size-6 sm:size-7"
        />
        <p className="min-w-0 shrink text-left text-xl leading-tight sm:text-2xl">
          {templateDraft.name}
        </p>
        <PenIcon className="ml-0.5 size-4 -rotate-30 opacity-0 transition group-focus-visible/button:rotate-0 group-focus-visible/button:opacity-100 group-active/button:rotate-0 group-active/button:opacity-100 has-hover:group-hover/button:rotate-0 has-hover:group-hover/button:opacity-100 sm:size-4.5" />
      </Button>
    </RenameEntityTrigger>
  );
}

function ThreeDotButton({
  templateDraft,
  className,
}: {
  templateDraft: TTemplateDraft;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { closePanel } = useTemplateDraftPanel();

  const removeTemplateDraft = useTemplateDraftStore((s) => s.remove);
  const timeout = useRef<NodeJS.Timeout>(undefined);

  const deleteTemplateDraft = useCallback(() => {
    closePanel();
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => {
      removeTemplateDraft(templateDraft.id);
    }, defaultAnimationMs);
  }, [templateDraft.id, closePanel, removeTemplateDraft]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          data-open={isOpen ? true : undefined}
          fadeOnDisabled={false}
          variant="ghost"
          size="icon"
          className={cn(
            "text-muted-more-foreground group/button rounded-lg group-data-placeholder/card:text-transparent",
            className,
          )}
        >
          <EllipsisVerticalIcon className="size-6 rotate-90 transition-transform group-data-open/button:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="z-50 w-40"
        sideOffset={-1}
        data-open={isOpen ? true : undefined}
        align="end"
        forceMount={true}
      >
        <ScrollArea>
          <DropdownMenuGroup>
            <DeleteEntityTrigger
              dialogTitle="Delete Template Draft"
              dialogDescription="Are you sure you want to delete this template draft? This action cannot be undone."
              onSubmit={async () => {
                deleteTemplateDraft();
              }}
              error={null}
              deletingEntityName={templateDraft.name}
              onDialogCloseImmediate={() => {
                setIsOpen(false);
              }}
              onDialogClose={() => {}}
              disableConfirmationInput
            >
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <TrashIcon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteEntityTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
