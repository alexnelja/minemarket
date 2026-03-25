// app/intelligence/page.tsx

import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { isAdmin } from '@/lib/admin';
import {
  getVolumeFlow,
  getSupplyIntelligence,
  getDemandIntelligence,
  getMarketConcentration,
  getDealVelocity,
  getVerificationInsights,
} from '@/lib/intelligence-queries';
import { VolumePanel } from './volume-panel';
import { SupplyPanel } from './supply-panel';
import { DemandPanel } from './demand-panel';
import { ConcentrationPanel } from './concentration-panel';
import { VelocityPanel } from './velocity-panel';
import { VerificationPanel } from './verification-panel';

export default async function IntelligencePage() {
  const user = await requireAuth();

  if (!isAdmin(user.id)) {
    redirect('/dashboard');
  }

  const [volumeFlow, supply, demand, concentration, velocity, verifications] = await Promise.all([
    getVolumeFlow(),
    getSupplyIntelligence(),
    getDemandIntelligence(),
    getMarketConcentration(),
    getDealVelocity(),
    getVerificationInsights(),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Intelligence</h1>
        <p className="text-gray-400 text-sm mt-1">
          Platform-wide analytics and market intelligence
        </p>
      </div>

      {/* Top row: Volume + Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VolumePanel rows={volumeFlow} />
        <VelocityPanel stages={velocity} />
      </div>

      {/* Middle: Supply + Demand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupplyPanel rows={supply} />
        <DemandPanel rows={demand} />
      </div>

      {/* Bottom: Concentration + Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConcentrationPanel rows={concentration} />
        <VerificationPanel rows={verifications} />
      </div>
    </div>
  );
}
