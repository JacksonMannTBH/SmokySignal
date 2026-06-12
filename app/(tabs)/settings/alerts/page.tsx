import { AlertsSettings } from "@/components/AlertsSettings";
import { ResetPreferencesButton } from "@/components/ResetPreferencesButton";

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
  return (
    <>
      <AlertsSettings />
      <div style={{ ...SECTION_WRAP, marginBottom: 80 }}>
        <ResetPreferencesButton />
      </div>
    </>
  );
}
