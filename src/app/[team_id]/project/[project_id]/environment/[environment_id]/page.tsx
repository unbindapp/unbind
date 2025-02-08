type Props = {
  params: Promise<{ environment_id: string; project_id: string }>;
};

export default async function Page({ params }: Props) {
  const { environment_id, project_id } = await params;
  return (
    <div className="w-full flex flex-col items-center justify-center flex-1 px-4 pt-12 pb-18">
      <div className="max-w-full flex flex-col gap-2">
        <p className="text-muted-foreground">
          Project ID:{" "}
          <span className="font-bold text-foreground">{project_id}</span>
        </p>
        <p className="text-muted-foreground">
          Environment ID:{" "}
          <span className="font-bold text-foreground">{environment_id}</span>
        </p>
      </div>
    </div>
  );
}
