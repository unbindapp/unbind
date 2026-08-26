import { LinkButton } from "@/components/ui/button";
import { CircleArrowUpIcon } from "lucide-react";

type TProps =
  | {
      isPending: false;
      currentVersion: string;
    }
  | {
      isPending: true;
      currentVersion?: string;
    };

export default function UpdateNotAvailableSection({ isPending, currentVersion }: TProps) {
  return (
    <>
      <div className="flex w-full flex-col items-center gap-1.5 px-1">
        <CircleArrowUpIcon className="group-data-pending/wrapper:animate-skeleton group-data-pending/wrapper:bg-muted-foreground size-8 group-data-pending/wrapper:rounded-full group-data-pending/wrapper:text-transparent" />
        <h1 className="group-data-pending/wrapper:animate-skeleton group-data-pending/wrapper:bg-muted-foreground max-w-full px-2 text-center text-2xl leading-tight font-semibold group-data-pending/wrapper:rounded-md group-data-pending/wrapper:text-transparent">
          No updates available
        </h1>
        <p className="text-muted-foreground group-data-pending/wrapper:animate-skeleton group-data-pending/wrapper:bg-muted-more-foreground max-w-full text-center group-data-pending/wrapper:rounded-md group-data-pending/wrapper:text-transparent">
          You are already on the latest version of Unbind.
        </p>
      </div>
      <GoHome isPending={isPending} />
      <div className="flex w-full items-center justify-center px-1">
        <p className="text-muted-foreground group-data-pending/wrapper:animate-skeleton group-data-pending/wrapper:bg-muted-more-foreground max-w-full rounded-full border px-2.5 py-0.5 text-center text-sm group-data-pending/wrapper:text-transparent">
          Current version:{" "}
          <span className="font-semibold">{isPending ? "a1a1a1a" : currentVersion}</span>
        </p>
      </div>
    </>
  );
}

export function GoHome({ isPending }: { isPending?: boolean }) {
  return (
    <div
      data-pending={isPending || undefined}
      className="group/div flex w-full flex-wrap items-center justify-center"
    >
      <div className="flex w-full px-1 py-1.5 sm:w-1/2">
        <LinkButton
          disabled={isPending}
          to="/"
          className="group-data-pending/div:animate-skeleton group-data-pending/div:bg-muted-foreground w-full group-data-pending/div:text-transparent"
        >
          Go Home
        </LinkButton>
      </div>
    </div>
  );
}
