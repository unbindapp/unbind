import { LoaderIcon } from "lucide-react";

export default function PendingScreen() {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-5 py-8">
      <LoaderIcon className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
