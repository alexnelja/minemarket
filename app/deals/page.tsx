import { requireAuth } from '@/lib/auth';
import { getDealsByUser, getDealMilestones } from '@/lib/deal-queries';
import { getMines, getHarbours } from '@/lib/queries';
import { PipelineTab } from './pipeline-tab';
import { ShipmentTab } from './shipment-tab';
import { DealsTabSwitcher } from './deals-tab-switcher';
import type { DealMilestone, GeoPoint } from '@/lib/types';

export default async function DealsPage() {
  const user = await requireAuth();
  const deals = await getDealsByUser(user.id);

  // Fetch milestones for in-transit deals
  const transitDeals = deals.filter((d) =>
    ['loading', 'in_transit', 'delivered'].includes(d.status)
  );
  const milestonesEntries = await Promise.all(
    transitDeals.map(async (d) => {
      const milestones = await getDealMilestones(d.id);
      return [d.id, milestones] as [string, DealMilestone[]];
    })
  );
  const milestonesMap = Object.fromEntries(milestonesEntries);

  // Get mine and harbour locations for map
  const [mines, harbours] = await Promise.all([getMines(), getHarbours()]);
  const mineLocations: Record<string, GeoPoint> = {};
  mines.forEach((m) => { mineLocations[m.name] = m.location; });
  const harbourLocations: Record<string, GeoPoint> = {};
  harbours.forEach((h) => { harbourLocations[h.name] = h.location; });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deal Tracker</h1>
          <p className="text-gray-400 text-sm">
            {deals.length} deal{deals.length !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      <DealsTabSwitcher
        pipelineContent={<PipelineTab deals={deals} />}
        shipmentContent={
          <ShipmentTab
            deals={deals}
            milestonesMap={milestonesMap}
            harbourLocations={harbourLocations}
            mineLocations={mineLocations}
          />
        }
      />
    </div>
  );
}
