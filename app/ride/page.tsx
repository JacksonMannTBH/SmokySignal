import { RideModeShell } from "@/components/RideModeShell";
import { getSnapshotForRender } from "@/lib/snapshot";
import { applyMockState, parseMockState } from "@/lib/mock-state";

export const metadata = {
  title: "Ride Mode",
  description: "One-glance aircraft awareness while riding.",
};

export const dynamic = "force-dynamic";

type SP = { mock?: string };

export default async function RidePage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const real = await getSnapshotForRender();
  const mockState = parseMockState(searchParams.mock);
  const mockOn = mockState !== null;
  const initial = applyMockState(real, mockState);
  return <RideModeShell initial={initial} mockOn={mockOn} />;
}
