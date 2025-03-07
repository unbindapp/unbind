import GitProviderButtons from "@/app/(team)/[team_id]/connect-git/_components/git-provider-buttons";
import { auth } from "@/server/auth/auth";
import { redirect } from "next/navigation";

type TProps = {
  params: Promise<{ team_id: string }>;
};

export default async function Page({ params }: TProps) {
  const { team_id: teamId } = await params;
  const session = await auth();
  if (!session) {
    redirect("/sign-in");
  }

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
          <GitProviderButtons teamId={teamId} session={session} />
        </div>
      </div>
    </div>
  );
}
