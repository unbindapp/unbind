export type TGitProvider = {
  name: string;
  slug: string;
};

export const gitProviders: TGitProvider[] = [
  {
    name: "GitHub",
    slug: "github",
  },
  {
    name: "GitLab",
    slug: "gitlab",
  },
];
