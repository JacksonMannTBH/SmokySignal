import { DashShell } from "@/components/DashShell";
import { getSnapshot } from "@/lib/snapshot";
import { getRecentActivity } from "@/lib/activity";
import { applyMockState, parseMockState } from "@/lib/mock-state";

export const metadata = {
  title: "Out Of Sight · Dash",
};

export const dynamic = "force-dynamic";

type SP = { mock?: string };

export default async function DashPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const [real, activity] = await Promise.all([
    getSnapshot(),
    getRecentActivity(10),
  ]);
  const mockState = parseMockState(searchParams.mock);
  const mockOn = mockState !== null;
  const initial = applyMockState(real, mockState);
  return <DashShell initial={initial} initialActivity={activity} mockOn={mockOn} />;
}
