import { LoaderIcon } from "lucide-react";

export default function PendingScreen() {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-5 pt-8 pb-[calc(2rem+6vh)]">
      <LoaderIcon className="text-muted-more-foreground size-8 animate-spin" />
    </div>
  );
}
