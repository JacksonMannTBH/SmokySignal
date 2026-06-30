import { TabBar } from "@/components/TabBar";
import { SpeedWarning } from "@/components/SpeedWarning";
import { ScreenAwake } from "@/components/ScreenAwake";
import { AppBadge } from "@/components/AppBadge";
import { getSpeedWarningEnabled } from "@/lib/flags";

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const speedWarningEnabled = await getSpeedWarningEnabled();
  return (
    <>
      <div id="main-content">{children}</div>
      <TabBar />
      <ScreenAwake />
      <AppBadge />
      <SpeedWarning enabled={speedWarningEnabled} />
    </>
  );
}
