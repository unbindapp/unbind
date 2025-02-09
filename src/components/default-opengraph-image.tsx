import Logo from "@/components/icons/logo";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CSSProperties } from "react";

type Props = {
  logoSize?: number;
};

export const logoAspectRatio = 99 / 24;
export const background = "hsl(120 9% 6%)";
export const foreground = "hsl(120 100% 97%)";
export const foregroundMuted = "hsl(120 6% 65%)";
export const backgroundHover = "hsl(120 11% 8%)";

export const opengraphSize = {
  width: 1200,
  height: 630,
};
export const opengraphContentType = "image/png";
export const defaultParagraphClassName: CSSProperties = {
  wordBreak: "break-word",
  textWrap: "balance",
};

export default function DefaultOpenGraphImage({ logoSize = 544 }: Props) {
  return (
    <div
      style={{
        background: background,
        color: foreground,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="240"
        height="126"
        fill="none"
        viewBox="0 0 240 126"
        style={{
          width: 1200,
          height: 630,
          color: backgroundHover,
          position: "absolute",
          left: 0,
          top: 0,
        }}
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M113-18c6.627 0 12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12v6h-16v-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0V4c0 6.627-5.373 12-12 12s-12-5.373-12-12V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0V4c0 6.627-5.373 12-12 12s-12-5.373-12-12V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0V4c0 6.627-5.373 12-12 12s-12-5.373-12-12V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0V4c0 6.627-5.373 12-12 12s-12-5.373-12-12V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0V4c0 6.627-5.373 12-12 12s-12-5.373-12-12V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0V4c0 6.627-5.373 12-12 12s-12-5.373-12-12V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0V4c0 6.627-5.373 12-12 12s-12-5.373-12-12V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0V4c0 6.627-5.373 12-12 12S83 10.627 83 4V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10S77-11.523 77-6v4h2v-4a8 8 0 1 1 16 0v2h-2v-2a6 6 0 0 0-12 0V4c0 6.627-5.373 12-12 12S57 10.627 57 4V-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10S51-11.523 51-6v4h2v-4a8 8 0 1 1 16 0v2h-2v-2a6 6 0 0 0-12 0V4c0 6.627-5.373 12-12 12S31 10.627 31 4V-6a4 4 0 1 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10S25-11.523 25-6v4h2v-4a8 8 0 1 1 16 0v2h-2v-2a6 6 0 0 0-12 0V4c0 6.627-5.373 12-12 12S5 10.627 5 4V-6a4 4 0 1 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10S-1-11.523-1-6v4h2v-4a8 8 0 1 1 16 0v2h-2v-2A6 6 0 0 0 3-6V4c0 6.627-5.373 12-12 12s-12-5.373-12-12V-6a4 4 0 1 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4A8 8 0 1 1-9-6v2h-2v-2a6 6 0 0 0-12 0V4c0 6.627-5.373 12-12 12s-12-5.373-12-12v-6h16v6a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 1 1-16 0V2h2v2a6 6 0 0 0 12 0V-6c0-6.627 5.373-12 12-12S-5-12.627-5-6V4a4 4 0 1 1-8 0V2h2v2a2 2 0 1 0 4 0V0h-12v4c0 5.523 4.477 10 10 10S1 9.523 1 4V0h-2v4a8 8 0 1 1-16 0V2h2v2A6 6 0 0 0-3 4V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0H7v4c0 5.523 4.477 10 10 10S27 9.523 27 4V0h-2v4A8 8 0 1 1 9 4V2h2v2a6 6 0 0 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0H33v4c0 5.523 4.477 10 10 10S53 9.523 53 4V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0H59v4c0 5.523 4.477 10 10 10S79 9.523 79 4V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 0 0 12 0V-6c0-6.627 5.373-12 12-12s12 5.373 12 12V4a4 4 0 0 1-8 0V2h2v2a2 2 0 1 0 4 0V0H85v4c0 5.523 4.477 10 10 10s10-4.477 10-10V0h-2v4a8 8 0 0 1-16 0V2h2v2a6 6 0 1 0 12 0V-6c0-6.627 5.373-12 12-12m7 44c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 0 1-4 0v-2h-2v2a4 4 0 1 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 0 1-4 0v-2h-2v2a4 4 0 1 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 0 1-4 0v-2h-2v2a4 4 0 1 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2H4v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10S2 41.523 2 36v-4h12v4a2 2 0 0 1-4 0v-2H8v2a4 4 0 0 0 8 0V26c0-6.627-5.373-12-12-12S-8 19.373-8 26v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 1 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0v-6h-16v6c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H2v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H28v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.372 12 12 12 6.627 0 12-5.373 12-12V26a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H54v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H80v-4a2 2 0 0 1 4 0v2h2v-2a4 4 0 1 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V26a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v6h16v-6c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V26c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V26m-5 32c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 0 1-4 0v-2h-2v2a4 4 0 1 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 0 1-4 0v-2h-2v2a4 4 0 1 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 0 1-4 0v-2h-2v2a4 4 0 1 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10S-3 73.523-3 68v-4H9v4a2 2 0 1 1-4 0v-2H3v2a4 4 0 0 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 1 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 0 1-12 0v-2h-2v2a8 8 0 1 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0v-6h-16v6c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10S9 52.477 9 58v4H-3v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10C-5 74.627.373 80 7 80s12-5.373 12-12V58a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H23v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.372 12 12 12 6.627 0 12-5.373 12-12V58a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H49v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H75v-4a2 2 0 0 1 4 0v2h2v-2a4 4 0 1 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 0 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V58a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v6h16v-6c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V58c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V58m-5 32c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12S8 83.373 8 90v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4H4v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90C6 83.373.627 78-6 78s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0v-6h-16v6c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10S4 84.477 4 90v4H-8v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H18v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.372 12 12 12 6.627 0 12-5.373 12-12V90a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H44v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 0 1 12 0v2h2v-2a8 8 0 1 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H70v-4a2 2 0 0 1 4 0v2h2v-2a4 4 0 1 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 0 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4H96v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v10c0 6.627 5.373 12 12 12s12-5.373 12-12V90a6 6 0 1 1 12 0v2h2v-2a8 8 0 0 0-16 0v4h-2v-4c0-5.523 4.477-10 10-10s10 4.477 10 10v4h-12v-4a2 2 0 1 1 4 0v2h2v-2a4 4 0 0 0-8 0v6h16v-6c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90c0-6.627-5.373-12-12-12s-12 5.373-12 12v10a6 6 0 1 1-12 0v-2h-2v2a8 8 0 0 0 16 0v-4h2v4c0 5.523-4.477 10-10 10s-10-4.477-10-10v-4h12v4a2 2 0 1 1-4 0v-2h-2v2a4 4 0 0 0 8 0V90m9 20c6.627 0 12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v6h-16v-6a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-10a4 4 0 0 1 8 0v2h-2v-2a2 2 0 1 0-4 0v4h12v-4c0-5.523-4.477-10-10-10s-10 4.477-10 10v4h2v-4a8 8 0 0 1 16 0v2h-2v-2a6 6 0 1 0-12 0v10c0 6.627-5.373 12-12 12s-12-5.373-12-12v-6h16v6a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4h-12v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4H5v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4H13v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4H39v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4H65v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12s12 5.373 12 12v10a4 4 0 0 1-8 0v-2h2v2a2 2 0 1 0 4 0v-4H91v4c0 5.523 4.477 10 10 10s10-4.477 10-10v-4h-2v4a8 8 0 0 1-16 0v-2h2v2a6 6 0 1 0 12 0v-10c0-6.627 5.373-12 12-12"
          clip-rule="evenodd"
        />
      </svg>
      <Logo
        variant="full"
        style={{
          width: logoSize,
          height: logoSize / logoAspectRatio,
          marginTop: -28,
          position: "relative",
        }}
      />
    </div>
  );
}

export async function getOpengraphFonts() {
  const getFontFile = async (path: string) => {
    const data = await readFile(
      join(process.cwd(), `public/static/fonts/${path}`)
    );
    const buffer = Uint8Array.from(data).buffer;
    return buffer;
  };

  const fontBold = getFontFile(`DMSansBold.ttf`);
  const fontSemiBold = getFontFile(`DMSansSemiBold.ttf`);
  const fontMedium = getFontFile(`DMSansMedium.ttf`);

  const [fontBoldData, fontSemiBoldData, fontMediumData] = await Promise.all([
    fontBold,
    fontSemiBold,
    fontMedium,
  ]);
  return [
    {
      name: "dm",
      weight: 700,
      style: "normal",
      data: fontBoldData,
    },
    {
      name: "dm",
      weight: 600,
      style: "normal",
      data: fontSemiBoldData,
    },
    {
      name: "dm",
      weight: 500,
      style: "normal",
      data: fontMediumData,
    },
  ] as const;
}

export async function DefaultOpenGraphResponse() {
  return new ImageResponse(<DefaultOpenGraphImage />, {
    ...opengraphSize,
    // @ts-expect-error - This is fine, they don't export the type so I can't set it
    fonts: await getOpengraphFonts(),
  });
}
