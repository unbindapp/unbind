import AppConfigProvider from "@/components/providers/app-config-provider";
import AsyncPushProvider from "@/components/providers/async-push-provider";
import DeviceSizeProvider from "@/components/providers/device-size-provider";
import DeviceTypeProvider from "@/components/providers/device-type-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import TimeProvider from "@/components/providers/time-provider";
import { env } from "@/lib/env";
import { TRPCReactProvider } from "@/server/trpc/setup/client";
import { Provider as JotaiProvider } from "jotai";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import React from "react";

export default async function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const authUrl = env.AUTH_URL;
  const authBasePath = new URL(authUrl || "https://unbind.app").pathname;

  return (
    <AppConfigProvider apiUrl={env.UNBIND_API_EXTERNAL_URL} siteUrl={env.SITE_URL}>
      <TRPCReactProvider>
        <SessionProvider basePath={authBasePath}>
          <AsyncPushProvider>
            <JotaiProvider>
              <NuqsAdapter>
                <ThemeProvider>
                  <DeviceTypeProvider>
                    <DeviceSizeProvider>
                      <TimeProvider>{children}</TimeProvider>
                    </DeviceSizeProvider>
                  </DeviceTypeProvider>
                </ThemeProvider>
              </NuqsAdapter>
            </JotaiProvider>
          </AsyncPushProvider>
        </SessionProvider>
      </TRPCReactProvider>
    </AppConfigProvider>
  );
}
