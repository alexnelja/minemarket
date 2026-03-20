import { getMines, getHarbours, getActiveListings } from '@/lib/queries';
import { MapClient } from './map-client';

export default async function MapPage() {
  const [mines, harbours, listings] = await Promise.all([
    getMines(),
    getHarbours(),
    getActiveListings(),
  ]);

  return <MapClient mines={mines} harbours={harbours} listings={listings} />;
}
