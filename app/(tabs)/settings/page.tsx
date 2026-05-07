import { redirect } from "next/navigation";

export const metadata = {
  title: "Settings",
};

export default function SettingsIndex() {
  redirect("/settings/alerts");
}
