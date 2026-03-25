import { getVesselPositions, getPortCongestion } from '@/lib/vessel-queries';
import { VesselMap } from './vessel-map';
import { CongestionSidebar } from './congestion-sidebar';

export const dynamic = 'force-dynamic';

export default async function VesselsPage() {
  const [vessels, congestion] = await Promise.all([
    getVesselPositions(),
    getPortCongestion(),
  ]);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-5rem)] -mx-6 md:-mx-10 -mt-6 md:-mt-10">
      {/* Map */}
      <div className="flex-1 relative">
        <VesselMap initialVessels={vessels} initialCongestion={congestion} />
      </div>

      {/* Sidebar */}
      <CongestionSidebar initialCongestion={congestion} vesselCount={vessels.length} />
    </div>
  );
}
