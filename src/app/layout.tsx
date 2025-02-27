import TopLoader from "@/components/navigation/top-loader";
import Providers from "@/components/providers/providers";
import { Toaster } from "@/components/ui/sonner";
import { siteDescription, siteTagline, siteTitle } from "@/lib/constants";
import { env } from "@/lib/env";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  InfoIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "@/app/globals.css";
import { metaTheme } from "@/components/providers/themes";
/* import { ReactScan } from "@/components/providers/react-scan"; */

const sans = localFont({
  src: "./font/DMSansVF.woff2",
  variable: "--font-sans",
  weight: "100 1000",
});
const mono = localFont({
  src: "./font/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

const title = `${siteTitle} | ${siteTagline}`;

export const viewport: Viewport = {
  themeColor: metaTheme.dark,
};
export const metadata: Metadata = {
  title,
  description: siteDescription,
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  twitter: {
    title,
    description: siteDescription,
    card: "summary_large_image",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} w-full flex flex-col min-h-[100svh] relative items-center bg-background text-foreground antialiased break-words`}
      >
        {/* <ReactScan /> */}
        <Providers>
          <TopLoader />
          {children}
          <Toaster
            position="top-right"
            icons={{
              error: <TriangleAlertIcon className="size-full" />,
              close: <XIcon strokeWidth={2.5} className="size-full" />,
              success: <CheckCircleIcon className="size-full" />,
              warning: <AlertCircleIcon className="size-full" />,
              info: <InfoIcon className="size-full" />,
            }}
            closeButton={true}
            duration={60000}
          />
        </Providers>
      </body>
    </html>
  );
}
