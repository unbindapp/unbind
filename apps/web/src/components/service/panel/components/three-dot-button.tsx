import { useServicePanel } from "@/components/service/panel/service-panel-provider";
import useDeleteService from "@/components/service/use-delete-service";
import { type TServiceShallow } from "@/lib/queries/services";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EllipsisVerticalIcon, Trash2Icon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";

type TProps = {
  service: TServiceShallow;
  className?: string;
};

export default function ThreeDotButton({ service, className }: TProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { closePanel } = useServicePanel();

  const {
    mutateAsync: deleteService,
    error,
    reset,
  } = useDeleteService({
    onSuccess: () => {
      setIsOpen(false);
      closePanel();
    },
  });

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            data-open={isOpen || undefined}
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
        }
      />
      <DropdownMenuContent
        className="z-50 w-40"
        sideOffset={-1}
        data-open={isOpen || undefined}
        align="end"
        keepMounted
      >
        <ScrollArea>
          <DropdownMenuGroup>
            <DeleteEntityTrigger
              dialogTitle="Delete Service"
              dialogDescription="Are you sure you want to delete this service? This action cannot be undone."
              onSubmit={async () => {
                await deleteService();
              }}
              error={error}
              deletingEntityName={service.name}
              onDialogCloseImmediate={() => {
                setIsOpen(false);
              }}
              onDialogClose={() => {
                reset();
              }}
              disableConfirmationInput
            >
              <DropdownMenuItem
                closeOnClick={false}
                className="text-destructive active:bg-destructive/10 data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
              >
                <Trash2Icon className="-ml-0.5 size-5" />
                <p className="min-w-0 shrink leading-tight">Delete</p>
              </DropdownMenuItem>
            </DeleteEntityTrigger>
          </DropdownMenuGroup>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
