import { frontmatterSchema, metaSchema } from "fumadocs-mdx/config";
import { defineDocs } from "fumadocs-mdx/macro";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content",
  docs: {
    async: true,
    schema: frontmatterSchema.extend({
      heading: z.string().optional(),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema.extend({
      color: z.enum(["success", "process", "warning"]).optional(),
    }),
  },
});
