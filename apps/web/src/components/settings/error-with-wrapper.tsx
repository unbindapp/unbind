import ErrorLine from "@/components/error-line";
import SettingsSectionWrapper from "@/components/settings/settings-section-wrapper";

export default function ErrorWithWrapper({ message }: { message: string }) {
  return (
    <SettingsSectionWrapper>
      <ErrorLine message={message} />
    </SettingsSectionWrapper>
  );
}
