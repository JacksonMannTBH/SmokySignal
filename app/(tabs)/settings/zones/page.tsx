import { redirect } from "next/navigation";

export const metadata = {
  title: "Settings",
  description: "Tune Out Of Sight alerts and region preferences.",
};

export const dynamic = "force-static";

export default function ZonesPage() {
  redirect("/settings/alerts");
}
