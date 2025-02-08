import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
  return (
    <div className="w-full flex-1 flex flex-col">
      <main className="w-full flex-1 flex flex-col items-center justify-center pt-12 pb-16 px-5">
        Home
      </main>
    </div>
  );
}
