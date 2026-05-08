import { TabBar } from "@/components/TabBar";
import { SpeedWarning } from "@/components/SpeedWarning";
import { ScreenAwake } from "@/components/ScreenAwake";
import { AppBadge } from "@/components/AppBadge";
import { SecondaryFooter } from "@/components/SecondaryFooter";
import { getSpeedWarningEnabled } from "@/lib/flags";

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const speedWarningEnabled = await getSpeedWarningEnabled();
  return (
    <>
      <a href="#main-content" className="ss-skip-link">
        Skip to main content
      </a>
      <div id="main-content">{children}</div>
      <SecondaryFooter />
      <TabBar />
      <ScreenAwake />
      <AppBadge />
      <SpeedWarning enabled={speedWarningEnabled} />
    </>
  );
}
