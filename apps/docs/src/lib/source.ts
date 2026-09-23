import { llms, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { brandIconsPlugin } from "./brand-icons";
import { docs } from "./docs";
import { openapi } from "./openapi";
import { orderReference } from "./reference-order";
import { docsRoute } from "./shared";
import { tabColorsPlugin } from "./tab-colors";

export const source = loader(
  {
    docs: docs.toFumadocsSource(),
    openapi: orderReference(
      await openapi.staticSource({ baseDir: "api/reference", groupBy: "tag", meta: true }),
      "api/reference",
    ),
  },
  {
    baseUrl: docsRoute,
    plugins: [brandIconsPlugin(), lucideIconsPlugin(), tabColorsPlugin(), openapi.loaderPlugin()],
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
