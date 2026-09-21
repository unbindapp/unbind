import { createGetUrl } from "fumadocs-core/source";

export const appName = "Unbind";
export const siteUrl = "https://docs.unbind.app";
export const docsRoute = "/";
export const contentDir = "apps/docs/content";

export const gitConfig = {
  user: "unbindapp",
  repo: "unbind",
  branch: "master",
};

const getDocsUrl = createGetUrl(docsRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs];
  if (segments.length === 0) {
    segments.push("index.md");
  } else {
    segments[segments.length - 1] += ".md";
  }

  return { segments, url: getDocsUrl(segments, page.locale) };
}

/** @returns page slugs */
export function decodeMarkdownUrl(segments: string[]) {
  if (segments.length === 0) return [];

  const out = [...segments];
  out[out.length - 1] = out[out.length - 1].replace(/\.md$/, "");
  if (out.length === 1 && out[0] === "index") out.pop();
  return out;
}
