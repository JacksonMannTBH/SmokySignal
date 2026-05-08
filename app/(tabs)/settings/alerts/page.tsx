import { AlertsSettings } from "@/components/AlertsSettings";
import { ContrastSetting } from "@/components/ContrastSetting";
import { TimeFormatSetting } from "@/components/TimeFormatSetting";
import { RegionSetting } from "@/components/RegionSetting";
import { ResetPreferencesButton } from "@/components/ResetPreferencesButton";
import { getContrastPref, getTimeFormatPref } from "@/lib/user-prefs";
import { getRegistry } from "@/lib/registry";

export const metadata = {
  title: "Alerts",
  description: "Get a ping when the bird's up.",
};

export const dynamic = "force-dynamic";

const SECTION_WRAP = {
  maxWidth: 460,
  margin: "16px auto 0",
  padding: "0 18px",
} as const;

export default async function AlertsPage() {
  const [timeFormat, contrast, registry] = await Promise.all([
    Promise.resolve(getTimeFormatPref()),
    Promise.resolve(getContrastPref()),
    getRegistry(),
  ]);
  return (
    <>
      <AlertsSettings
        tails={registry.map((f) => ({
          tail: f.tail,
          nickname: f.nickname,
          operator: f.operator,
          role: f.role,
        }))}
      />
      <div style={SECTION_WRAP}>
        <TimeFormatSetting current={timeFormat} />
      </div>
      <div style={SECTION_WRAP}>
        <ContrastSetting current={contrast} />
      </div>
      <div style={SECTION_WRAP}>
        <RegionSetting />
      </div>
      <div style={{ ...SECTION_WRAP, marginBottom: 80 }}>
        <ResetPreferencesButton />
      </div>
    </>
  );
}
