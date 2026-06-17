export const availableThemes = ["dark", "light", "system"] as const;
export const themes = [...availableThemes];
export type TTheme = (typeof availableThemes)[number];
export type TThemeWithoutSystem = Exclude<TTheme, "system">;
export const defaultTheme: TThemeWithoutSystem = "dark";

export const metaTheme: Record<TThemeWithoutSystem, string> = {
  dark: "#0F120F",
  light: "#EEF7EE",
};
