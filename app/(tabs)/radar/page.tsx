import { RadarShell } from "@/components/RadarShell";
import { getSnapshot } from "@/lib/snapshot";
import { applyMockState, parseMockState } from "@/lib/mock-state";
import { getFreshness } from "@/lib/freshness";

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
  const [real, freshness] = await Promise.all([
    getSnapshot(),
    getFreshness(),
  ]);
  const mockState = parseMockState(searchParams.mock);
  const mockOn = mockState !== null;
  const initial = applyMockState(real, mockState);
  return (
    <RadarShell
      initial={initial}
      mockOn={mockOn}
      lastSampleMs={freshness.lastSampleMs}
    />
  );
}
