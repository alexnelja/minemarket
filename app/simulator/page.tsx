import { getMines, getHarbours } from '@/lib/queries';
import { getLatestPrices } from '@/lib/commodity-prices';
import { SimulatorClient } from './simulator-client';

export const metadata = {
  title: 'Deal Simulator | MineMarket',
  description: 'Forward waterfall calculator — mine gate to CIF cost and margin',
};

export default async function SimulatorPage() {
  const [mines, harbours, latestPrices] = await Promise.all([
    getMines(),
    getHarbours(),
    getLatestPrices(),
  ]);

  // Extract loading ports (SA ports with type 'loading' or 'both')
  const loadingPorts = harbours
    .filter(h => h.type === 'loading' || h.type === 'both')
    .map(h => ({ id: h.id, name: h.name, location: h.location, country: h.country }));

  // Extract destination ports
  const destinationPorts = harbours
    .filter(h => h.type === 'destination' || h.type === 'both')
    .map(h => ({ id: h.id, name: h.name, location: h.location, country: h.country }));

  // Build price map for default index prices
  const indexPrices: Record<string, number> = {};
  for (const [commodity, priceData] of Object.entries(latestPrices)) {
    indexPrices[commodity] = priceData.price_usd;
  }

  return (
    <div className="min-h-screen">
      <SimulatorClient
        mines={mines}
        loadingPorts={loadingPorts}
        destinationPorts={destinationPorts}
        indexPrices={indexPrices}
      />
    </div>
  );
}
