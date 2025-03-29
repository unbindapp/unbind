import LogViewer from "@/components/logs/log-viewer";
import { auth } from "@/server/auth/auth";

export default async function Page() {
  const session = await auth();
  if (!session) return null;

  return <LogViewer containerType="page" session={session} />;
}
