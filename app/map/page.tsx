import { getMines, getHarbours, getActiveListings, getRoutes } from '@/lib/queries';
import { MapClient } from './map-client';

export default async function MapPage() {
  const [mines, harbours, listings, routes] = await Promise.all([
    getMines(),
    getHarbours(),
    getActiveListings(),
    getRoutes(),
  ]);

  return <MapClient mines={mines} harbours={harbours} listings={listings} routes={routes} />;
}
