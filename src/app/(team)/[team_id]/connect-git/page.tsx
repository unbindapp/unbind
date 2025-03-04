import GitProviderIcon from "@/components/icons/git-provider";
import { Button } from "@/components/ui/button";

export default async function Page() {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center px-4 pt-6 pb-[calc(2rem+5svh)] sm:pt-8 sm:pb-[calc(2rem+12svh)]">
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center justify-center px-2 text-center">
          <h1 className="min-w-0 px-2 text-2xl leading-tight font-bold">Connect Git</h1>
          <p className="text-muted-foreground mt-1 w-full">
            Select a Git provider to import your repos.
          </p>
        </div>
        <div className="mt-5 flex w-full max-w-xs flex-col gap-2">
          <Button variant="github" className="px-11">
            <GitProviderIcon
              className="absolute top-1/2 left-5.75 size-6 -translate-1/2"
              variant="github"
            />
            <p className="min-w-0 shrink">Continue with GitHub</p>
          </Button>
          <Button variant="gitlab" className="px-11">
            <GitProviderIcon
              className="absolute top-1/2 left-5.75 size-6 -translate-1/2"
              variant="gitlab"
            />
            <p className="min-w-0 shrink">Continue with GitLab</p>
          </Button>
        </div>
      </div>
    </div>
  );
}
