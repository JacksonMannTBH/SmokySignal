import { TabBar } from "@/components/TabBar";
import { SpeedWarning } from "@/components/SpeedWarning";
import { ScreenAwake } from "@/components/ScreenAwake";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppBadge } from "@/components/AppBadge";
import { SecondaryFooter } from "@/components/SecondaryFooter";
import { SkipLink } from "@/components/SkipLink";
import { getSpeedWarningEnabled } from "@/lib/flags";

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const speedWarningEnabled = await getSpeedWarningEnabled();
  return (
    <>
      <SkipLink />
      <div id="main-content">{children}</div>
      <SecondaryFooter />
      <TabBar />
      <ThemeToggle />
      <ScreenAwake />
      <AppBadge />
      <SpeedWarning enabled={speedWarningEnabled} />
    </>
  );
}
