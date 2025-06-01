import { DeleteEntityTrigger } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TriangleAlertIcon } from "lucide-react";

type Props = {
  buttonText: string;
  paragraph: string;
  deletingEntityName: string;
  dialogTitle: string;
  dialogDescription: string;
  onSubmit: () => Promise<void>;
  onDialogClose: () => void;
  error: { message: string } | null;
  className?: string;
};

export default function DeleteCard({
  buttonText,
  paragraph,
  deletingEntityName,
  dialogTitle,
  dialogDescription,
  onSubmit,
  onDialogClose,
  error,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "bg-destructive/8 text-destructive flex w-full flex-col items-start justify-start gap-4 rounded-xl px-4 py-4 md:max-w-xl",
        className,
      )}
    >
      <div className="-mt-0.75 flex w-full items-start justify-start gap-2 px-1">
        <TriangleAlertIcon className="mt-0.5 size-4.5 shrink-0" />
        <p className="min-w-0 shrink leading-snug text-balance">{paragraph}</p>
      </div>
      <DeleteButton
        dialogTitle={dialogTitle}
        dialogDescription={dialogDescription}
        buttonText={buttonText}
        onSubmit={onSubmit}
        onDialogClose={onDialogClose}
        deletingEntityName={deletingEntityName}
        error={error}
      />
    </div>
  );
}

function DeleteButton({
  buttonText,
  dialogTitle,
  dialogDescription,
  deletingEntityName,
  onSubmit,
  onDialogClose,
  error,
}: {
  buttonText: string;
  dialogTitle: string;
  dialogDescription: string;
  deletingEntityName: string;
  onSubmit: () => Promise<void>;
  onDialogClose: () => void;
  error: { message: string } | null;
}) {
  return (
    <DeleteEntityTrigger
      dialogTitle={dialogTitle}
      dialogDescription={dialogDescription}
      deletingEntityName={deletingEntityName}
      onSubmit={onSubmit}
      onDialogClose={onDialogClose}
      error={error}
    >
      <Button variant="destructive">{buttonText}</Button>
    </DeleteEntityTrigger>
  );
}
