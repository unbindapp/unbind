import TabWrapper from "@/components/navigation/tab-wrapper";
import NoItemsCard from "@/components/no-items-card";
import {
  shouldServiceSettingsHaveBackupsSection,
  shouldServiceSettingsHaveBuildSection,
  shouldServiceSettingsHaveDatabaseSection,
  shouldServiceSettingsHaveDeploySection,
  shouldServiceSettingsHaveHealthSection,
} from "@/components/service/panel/content/deployed/settings/helpers";
import BackupsSection from "@/components/service/panel/content/deployed/settings/sections/backups-section";
import BuildSection from "@/components/service/panel/content/deployed/settings/sections/build-section";
import DatabaseSection from "@/components/service/panel/content/deployed/settings/sections/database-section";
import DeleteSection from "@/components/service/panel/content/deployed/settings/sections/delete-section";
import DeploySection from "@/components/service/panel/content/deployed/settings/sections/deploy-section";
import HealthSection from "@/components/service/panel/content/deployed/settings/sections/health-section";
import NetworkingSection from "@/components/service/panel/content/deployed/settings/sections/networking/networking-section";
import SourceSection from "@/components/service/panel/content/deployed/settings/sections/source-section";
import SettingsSearchBar from "@/components/service/panel/content/deployed/settings/settings-search-bar";
import {
  SettingsSearchProvider,
  useSettingsSearch,
} from "@/components/service/panel/content/deployed/settings/settings-search-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TServiceShallow } from "@/lib/queries/services";
import { SearchIcon } from "lucide-react";

export default function Settings({ service }: { service: TServiceShallow }) {
  return (
    <SettingsSearchProvider>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <div className="relative z-10 w-full shrink-0 px-2.5 pt-3 sm:px-5.5 sm:pt-6">
          <SettingsSearchBar className="md:max-w-[calc(var(--container-xl)+0.5rem)]" />
        </div>
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden mask-[linear-gradient(to_bottom,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]">
          <ScrollArea classNameViewport="pb-(--safe-area-inset-bottom)">
            <TabWrapper className="gap-6 pt-3 sm:pt-4">
              <SourceSection service={service} />
              <NetworkingSection service={service} />
              {shouldServiceSettingsHaveBackupsSection(service) && (
                <BackupsSection service={service} />
              )}
              {shouldServiceSettingsHaveBuildSection(service) && <BuildSection service={service} />}
              {shouldServiceSettingsHaveDeploySection(service) && (
                <DeploySection service={service} />
              )}
              {shouldServiceSettingsHaveHealthSection(service) && (
                <HealthSection service={service} />
              )}
              {shouldServiceSettingsHaveDatabaseSection(service) && (
                <DatabaseSection service={service} />
              )}
              <DeleteSection service={service} className="mt-1" />
              <NoMatchesCard />
            </TabWrapper>
          </ScrollArea>
        </div>
      </div>
    </SettingsSearchProvider>
  );
}

// Sections render nothing when the search hides them, so this is the only child left
function NoMatchesCard() {
  const { query } = useSettingsSearch();
  return (
    <NoItemsCard Icon={SearchIcon} className="hidden only:flex md:max-w-xl">
      {`No settings match "${query.trim()}"`}
    </NoItemsCard>
  );
}
