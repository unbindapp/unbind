import Logo from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { TriangleAlertIcon } from "lucide-react";

type TProps = {
  error: Error & { digest?: string };
  reset: () => void;
  hideLogo?: boolean;
};

export default function ErrorPageTemplate({ error, reset, hideLogo }: TProps) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pt-8 pb-[calc(2rem+8vh)]">
      <div className="flex w-full max-w-xl flex-col items-center justify-center gap-5">
        {!hideLogo && <Logo variant="full" className="w-36 max-w-full" />}
        <div className="bg-background-hover flex w-full flex-col gap-2 rounded-xl border px-4 pt-2.5 pb-4">
          <div className="text-destructive flex w-full items-center justify-start gap-2">
            <TriangleAlertIcon className="size-5 shrink-0" />
            <h1 className="min-w-0 shrink text-xl leading-tight font-bold">Error</h1>
          </div>
          <p className="w-full font-mono text-sm leading-tight whitespace-pre-wrap">
            {error.message}
          </p>
        </div>
        <Button onClick={() => reset()}>Try Again</Button>
      </div>
    </div>
  );
}
