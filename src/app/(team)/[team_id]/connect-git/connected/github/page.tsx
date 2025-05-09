import Content from "@/app/(team)/[team_id]/connect-git/connected/github/_components/content";

type TProps = {
  searchParams: Promise<{ id: string }>;
};

export default async function Page({ searchParams }: TProps) {
  const { id } = await searchParams;
  return <Content id={id} />;
}
