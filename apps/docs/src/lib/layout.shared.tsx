import Logo from "@/components/icons/logo";
import { FullSearchTrigger, SearchTrigger } from "@/components/search-trigger";
import { ThemeSwitch } from "@/components/theme-switch";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Logo variant="full" />
          <span className="sr-only">{appName}</span>
        </>
      ),
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    slots: {
      themeSwitch: ThemeSwitch,
      searchTrigger: { sm: SearchTrigger, full: FullSearchTrigger },
    },
  };
}
