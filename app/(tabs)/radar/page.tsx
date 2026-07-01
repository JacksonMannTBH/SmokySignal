import { RadarShell } from "@/components/RadarShell";
import { getSnapshotForRender } from "@/lib/snapshot";
import { applyMockState, parseMockState } from "@/lib/mock-state";

export const metadata = {
  title: "Radar",
};

export const dynamic = "force-dynamic";

type SP = { mock?: string };

export default async function RadarPage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const real = await getSnapshotForRender();
  const mockState = parseMockState(searchParams.mock);
  const mockOn = mockState !== null;
  const initial = applyMockState(real, mockState);
  return <RadarShell initial={initial} mockOn={mockOn} />;
}
