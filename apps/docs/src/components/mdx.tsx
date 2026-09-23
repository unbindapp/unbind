import defaultMdxComponents from "fumadocs-ui/mdx";
import { Step, Steps } from "fumadocs-ui/components/steps";
import type { MDXComponents } from "mdx/types";
import { TemplateInputs, TemplateServices } from "@/components/template-facts";
import { CodeBlock } from "@/components/code-block";
import { Card } from "@/components/card";
import { BrandLabel } from "@/components/brand-label";
import { Callout } from "@/components/callout";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    pre: CodeBlock,
    BrandLabel,
    Callout,
    Card,
    Step,
    Steps,
    TemplateInputs,
    TemplateServices,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
