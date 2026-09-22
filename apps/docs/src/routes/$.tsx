import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { createServerFn } from "@tanstack/react-start";
import { docs } from "@/lib/docs";
import { source } from "@/lib/source";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { CopyMarkdownButton, ViewOptionsPopover } from "@/components/page-actions";
import { baseOptions } from "@/lib/layout.shared";
import { appName, contentDir, getPageMarkdownUrl, gitConfig, siteUrl } from "@/lib/shared";
import { staticFunctionMiddleware } from "@tanstack/start-static-server-functions";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Suspense, use } from "react";
import { useMDXComponents } from "@/components/mdx";
import { OpenAPIPage } from "@/components/api-page";
import { pruneSpec } from "@/lib/prune-spec";

export const Route = createFileRoute("/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await loader({ data: slugs });
    if (data.type === "docs") await docs.getPage(data.path)?.preload();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};

    const title = `${loaderData.title} | ${appName} Docs`;
    const url = `${siteUrl}${loaderData.url === "/" ? "" : loaderData.url}`;
    return {
      meta: [
        { title },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: title },
        { property: "og:description", content: loaderData.description },
        { property: "og:url", content: url },
        { property: "og:site_name", content: `${appName} Docs` },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
});

const loader = createServerFn({
  method: "GET",
})
  .validator((slugs: string[]) => slugs)
  .middleware([staticFunctionMiddleware])
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    const shared = {
      url: page.url,
      description: page.data.description,
      markdownUrl: getPageMarkdownUrl(page).url,
      pageTree: await source.serializePageTree(source.getPageTree()),
    };

    if (page.type === "openapi") {
      const props = page.data.getOpenAPIPageProps();
      return {
        ...shared,
        type: "openapi" as const,
        title: page.data.title,
        props: {
          ...props,
          payload: {
            ...props.payload,
            bundled: pruneSpec(props.payload.bundled, props.operations ?? []),
          },
        },
      };
    }

    return {
      ...shared,
      type: "docs" as const,
      title: page.data.heading ?? page.data.title,
      path: page.path,
    };
  });

const repoUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}`;
const specGithubUrl = `${repoUrl}/apps/docs/generated/openapi.gen.yaml`;

function PageActions({ markdownUrl, githubUrl }: { markdownUrl: string; githubUrl?: string }) {
  return (
    <div className="-mt-4 flex flex-row items-center gap-2 border-b pb-6">
      <CopyMarkdownButton markdownUrl={markdownUrl} />
      <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={githubUrl} />
    </div>
  );
}

function Content({ path, markdownUrl }: { path: string; markdownUrl: string }) {
  const page = docs.getPage(path);
  if (!page) throw new Error(`unknown page: ${path}`);

  const { toc } = use(page.load());
  const MDX = page.body;

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.heading ?? page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <PageActions markdownUrl={markdownUrl} githubUrl={`${repoUrl}/${contentDir}/${path}`} />
      <DocsBody>
        <MDX components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

function Page() {
  const page = useFumadocsLoader(Route.useLoaderData());

  return (
    <DocsLayout {...baseOptions()} tree={page.pageTree}>
      <Link to={page.markdownUrl} hidden />
      {page.type === "openapi" ? (
        <DocsPage full>
          <DocsTitle>{page.title}</DocsTitle>
          <DocsDescription>{page.description}</DocsDescription>
          <PageActions markdownUrl={page.markdownUrl} githubUrl={specGithubUrl} />
          <DocsBody>
            <OpenAPIPage {...page.props} />
          </DocsBody>
        </DocsPage>
      ) : (
        <Suspense>
          <Content path={page.path} markdownUrl={page.markdownUrl} />
        </Suspense>
      )}
    </DocsLayout>
  );
}
