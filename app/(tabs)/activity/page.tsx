import { ActivityFeed } from "@/components/ActivityFeed";
import { getRecentActivity } from "@/lib/activity";
import { getSnapshot } from "@/lib/snapshot";

export const metadata = {
  title: "Activity",
};

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await getSnapshot();
  const initial = await getRecentActivity(50);
  return <ActivityFeed initial={initial} />;
}
