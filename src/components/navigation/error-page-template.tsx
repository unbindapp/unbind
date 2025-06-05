import { Button } from "@/components/ui/button";
import { TriangleAlertIcon } from "lucide-react";

type TProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPageTemplate({ error, reset }: TProps) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-5 pt-8 pb-[calc(2rem+8vh)]">
      <div className="flex w-full max-w-xl flex-col items-center justify-center">
        <div className="text-destructive flex w-full items-center justify-center gap-3">
          <TriangleAlertIcon className="size-8 shrink-0" />
          <p className="min-w-0 shrink text-4xl font-bold">Error</p>
        </div>
        <h1 className="bg-background-hover mt-3 max-w-full rounded-lg border px-3 py-2 font-mono text-sm leading-tight whitespace-pre-wrap">
          {error.message}
        </h1>
        <Button onClick={() => reset()} className="mt-5">
          Try Again
        </Button>
      </div>
    </div>
  );
}
