import { llms, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { docs } from "./docs";
import { openapi } from "./openapi";
import { docsRoute } from "./shared";

export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    openapi: await openapi.staticSource({
      baseDir: "api/reference",
      groupBy: "tag",
    }),
  },
  {
    baseUrl: docsRoute,
    plugins: [lucideIconsPlugin(), openapi.loaderPlugin()],
  },
);

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${page.url})

${await getPageText(page)}`,
});

async function getPageText(page: (typeof source)["$inferPage"]) {
  if (page.type === "docs") return page.data.getText("processed");

  return page.data.structuredData.contents.map((block) => block.content).join("\n\n");
}
