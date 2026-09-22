import { baseOptions } from "@/lib/layout.shared";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { DefaultNotFound } from "fumadocs-ui/layouts/home/not-found";
import { appName } from "@/lib/shared";

export const notFoundHead = {
  meta: [{ title: `Page not found | ${appName} Docs` }, { name: "robots", content: "noindex" }],
};

export function NotFound() {
  return (
    <HomeLayout {...baseOptions()}>
      <DefaultNotFound />
    </HomeLayout>
  );
}
