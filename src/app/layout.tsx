import "@/app/globals.css";
import TopLoader from "@/components/navigation/top-loader";
import Providers from "@/components/providers/providers";
import { metaTheme } from "@/components/providers/themes";
import { Toaster } from "@/components/ui/sonner";
import { imagePreviewVersion, siteDescription, siteTagline, siteTitle } from "@/lib/constants";
import { AlertCircleIcon, CheckCircleIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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
  openGraph: {
    title,
    description: siteDescription,
    images: [
      {
        url: `/previews/${imagePreviewVersion}/home.png`,
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    title,
    description: siteDescription,
    card: "summary_large_image",
    images: [{ url: `/previews/${imagePreviewVersion}/home.png`, width: 1200, height: 630 }],
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
        className={`${sans.variable} ${mono.variable} bg-background text-foreground relative flex min-h-[100svh] w-full flex-col items-center break-words antialiased`}
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
