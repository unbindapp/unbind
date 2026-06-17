import AppConfigProvider from "@/components/providers/app-config-provider";
import AsyncPushProvider from "@/components/providers/async-push-provider";
import DeviceSizeProvider from "@/components/providers/device-size-provider";
import DeviceTypeProvider from "@/components/providers/device-type-provider";
import NowProvider from "@/components/providers/now-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { MainStoreProvider } from "@/components/stores/main/main-store-provider";
import { TemplateDraftStoreProvider } from "@/components/templates/template-draft-store-provider";
import CheckForUpdatesProvider from "@/components/update/check-for-updates-provider";
import { getConfig } from "@/lib/config";
import { Provider as JotaiProvider } from "jotai";
import React from "react";

export default function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppConfigProvider apiUrl={getConfig().apiUrl}>
      <AsyncPushProvider>
        <JotaiProvider>
          <ThemeProvider>
            <DeviceTypeProvider>
              <DeviceSizeProvider>
                <NowProvider>
                  <MainStoreProvider>
                    <TemplateDraftStoreProvider>
                      <CheckForUpdatesProvider>{children}</CheckForUpdatesProvider>
                    </TemplateDraftStoreProvider>
                  </MainStoreProvider>
                </NowProvider>
              </DeviceSizeProvider>
            </DeviceTypeProvider>
          </ThemeProvider>
        </JotaiProvider>
      </AsyncPushProvider>
    </AppConfigProvider>
  );
}
