export const siteTitle = "Unbind";
export const siteTagline = "Self-hosting done right";
export const siteDescription = "Self-hosting done right.";
export const staticAssetsRoute = "/static";

export type TScOption = "x" | "github";

export const sc: Record<
  TScOption,
  {
    name: string;
    href: string;
    slug: TScOption;
    joinable: boolean;
    xOrder: number;
  }
> = {
  x: {
    name: "X (Twitter)",
    href: "https://x.com/unbindapp",
    slug: "x",
    joinable: true,
    xOrder: 1,
  },
  github: {
    name: "GitHub",
    href: "https://github.com/unbindapp/unbind",
    slug: "github",
    joinable: true,
    xOrder: 2,
  },
};

export const defaultAnimationMs = 150;
