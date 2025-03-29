import AsyncPushProvider from "@/components/providers/async-push-provider";
import DeviceSizeProvider from "@/components/providers/device-size-provider";
import DeviceTypeProvider from "@/components/providers/device-type-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import TimestampProvider from "@/components/providers/timestamp-provider";
import { TRPCReactProvider } from "@/server/trpc/setup/client";
import { Provider as JotaiProvider } from "jotai";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import React from "react";
import { SessionProvider } from "next-auth/react";

export default async function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <TRPCReactProvider>
      <SessionProvider>
        <AsyncPushProvider>
          <JotaiProvider>
            <NuqsAdapter>
              <ThemeProvider>
                <DeviceTypeProvider>
                  <DeviceSizeProvider>
                    <TimestampProvider>{children}</TimestampProvider>
                  </DeviceSizeProvider>
                </DeviceTypeProvider>
              </ThemeProvider>
            </NuqsAdapter>
          </JotaiProvider>
        </AsyncPushProvider>
      </SessionProvider>
    </TRPCReactProvider>
  );
}
