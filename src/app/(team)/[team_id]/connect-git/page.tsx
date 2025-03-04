import GitProviderIcon from "@/components/icons/git-provider";
import PageWrapper from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";

export default async function Page() {
  return (
    <PageWrapper className="pt-12 pb-[calc(3rem+4vh)] sm:pb-[calc(3rem+8vh)]">
      <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center justify-center px-2 text-center">
          <h1 className="min-w-0 px-2 text-2xl leading-tight font-bold">Connect Git</h1>
          <p className="text-muted-foreground mt-1 w-full leading-relaxed">
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
    </PageWrapper>
  );
}
