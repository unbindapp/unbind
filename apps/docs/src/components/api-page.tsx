import { ApiCodeBlock } from "@/components/code-block";
import { createOpenAPIPage } from "fumadocs-openapi/ui";
import { shikiThemes } from "@/lib/theme/shiki-theme";

export const OpenAPIPage = createOpenAPIPage({
  shikiOptions: { themes: shikiThemes, defaultColor: false },
  components: { CodeBlock: ApiCodeBlock },
});
