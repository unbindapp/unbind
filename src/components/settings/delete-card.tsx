import { DeleteEntityTrigger, TDeleteType } from "@/components/triggers/delete-entity-trigger";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TriangleAlertIcon } from "lucide-react";
import { useMemo } from "react";

type Props = {
  className?: string;
  deletingEntityName: string | undefined;
  onSubmit: () => Promise<void>;
  onDialogClose: () => void;
  error: { message: string } | null;
  type: TDeleteType;
};

export default function DeleteCard({
  className,
  deletingEntityName,
  onSubmit,
  onDialogClose,
  error,
  type,
}: Props) {
  const paragraph = useMemo(() => getParagraph(type), [type]);
  return (
    <div
      className={cn(
        "bg-destructive/8 text-destructive flex w-full max-w-xl flex-col items-start justify-start gap-4 rounded-xl px-4 py-4",
        className,
      )}
    >
      <div className="-mt-0.75 flex w-full items-center justify-start gap-2 px-1">
        <TriangleAlertIcon className="size-4.5 shrink-0" />
        <p className="min-w-0 shrink leading-snug text-balance">{paragraph}</p>
      </div>
      <DeleteButton
        type={type}
        onSubmit={onSubmit}
        onDialogClose={onDialogClose}
        deletingEntityName={deletingEntityName}
        error={error}
      />
    </div>
  );
}

function DeleteButton({
  type,
  deletingEntityName,
  onSubmit,
  onDialogClose,
  error,
}: {
  type: TDeleteType;
  deletingEntityName?: string;
  onSubmit: () => Promise<void>;
  onDialogClose: () => void;
  error: { message: string } | null;
}) {
  const buttonText = useMemo(() => getButtonText(type), [type]);

  return (
    <DeleteEntityTrigger
      type={type}
      deletingEntityName={deletingEntityName}
      onSubmit={onSubmit}
      onDialogClose={onDialogClose}
      error={error}
    >
      <Button variant="destructive">{buttonText}</Button>
    </DeleteEntityTrigger>
  );
}

function getParagraph(type: TDeleteType) {
  if (type === "service") {
    return "This action cannot be undone. All data inside the service will be permanently deleted.";
  }
  if (type === "project") {
    return "This action cannot be undone. All environments, services, and data inside this project will be permanently deleted.";
  }
  if (type === "template-draft") {
    return "This action cannot be undone. All data inside the template will be permanently deleted.";
  }
  return "This action cannot be undone. All the projects, environments, services, and data inside this team will be permanently deleted.";
}

function getButtonText(type: TDeleteType) {
  if (type === "service") return "Delete Service";
  if (type === "project") return "Delete Project";
  if (type === "template-draft") return "Delete Template";
  return "Delete Team";
}
