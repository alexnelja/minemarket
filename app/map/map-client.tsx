'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { COMMODITY_CONFIG, MineWithGeo, HarbourWithGeo, ListingWithDetails, CommodityType } from '@/lib/types';
import { fetchRoadRoute, generateOceanRoute, RouteSegment } from '@/lib/routes';
import { ListingsPanel } from './listings-panel';
import { FilterBar, Filters } from './filter-bar';

const DEFAULT_FILTERS: Filters = {
  commodities: [],
  verifiedOnly: false,
  priceMin: null,
  priceMax: null,
  volumeMin: null,
  incoterm: null,
};

function applyFilters(listings: ListingWithDetails[], filters: Filters): ListingWithDetails[] {
  return listings.filter((l) => {
    if (filters.commodities.length > 0 && !filters.commodities.includes(l.commodity_type as CommodityType)) {
      return false;
    }
    if (filters.verifiedOnly && !l.is_verified) {
      return false;
    }
    if (filters.priceMin !== null && l.price_per_tonne < filters.priceMin) {
      return false;
    }
    if (filters.priceMax !== null && l.price_per_tonne > filters.priceMax) {
      return false;
    }
    if (filters.volumeMin !== null && l.volume_tonnes < filters.volumeMin) {
      return false;
    }
    if (filters.incoterm !== null && !l.incoterms.includes(filters.incoterm)) {
      return false;
    }
    return true;
  });
}

// Representative global destination port (Shanghai)
const SHANGHAI: { lng: number; lat: number } = { lng: 121.47, lat: 31.23 };

interface MapClientProps {
  mines: MineWithGeo[];
  harbours: HarbourWithGeo[];
  listings: ListingWithDetails[];
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export function MapClient({ mines, harbours, listings }: MapClientProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const roadRouteCacheRef = useRef<RouteSegment[]>([]);
  const mapReadyRef = useRef(false);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const filteredListings = applyFilters(listings, filters);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [26, -29],
      zoom: 5,
    });

    mapRef.current = map;

    // Navigation controls bottom-right
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('style.load', () => {
      mapReadyRef.current = true;

      // --- Add empty road-routes source + layer (filled after API calls) ---
      map.addSource('road-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'road-routes-layer',
        type: 'line',
        source: 'road-routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2,
          'line-opacity': 0.7,
        },
      });

      // --- Add empty ocean-routes source + layer ---
      map.addSource('ocean-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'ocean-routes-layer',
        type: 'line',
        source: 'ocean-routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2,
          'line-dasharray': [4, 3],
          'line-opacity': 0.6,
        },
      });

      // --- Mine markers ---
      for (const mine of mines) {
        const primaryCommodity = mine.commodities[0] as CommodityType | undefined;
        const color = primaryCommodity ? COMMODITY_CONFIG[primaryCommodity]?.color ?? '#9ca3af' : '#9ca3af';

        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = color;
        el.style.border = '2px solid rgba(255,255,255,0.25)';
        el.style.cursor = 'pointer';
        el.style.boxShadow = `0 0 6px ${color}80`;

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px 2px;">
            <div style="font-weight: 600; font-size: 13px; color: #f9fafb; margin-bottom: 2px;">${mine.name}</div>
            <div style="font-size: 11px; color: #9ca3af;">${mine.region}, ${mine.country}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">
              ${mine.commodities.map((c) => COMMODITY_CONFIG[c as CommodityType]?.label ?? c).join(' · ')}
            </div>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 10, closeButton: false })
          .setHTML(popupHtml);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([mine.location.lng, mine.location.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.addTo(map);
        });

        markersRef.current.push(marker);
      }

      // --- Harbour markers ---
      for (const harbour of harbours) {
        const el = document.createElement('div');
        el.style.width = '12px';
        el.style.height = '12px';
        el.style.borderRadius = '2px';
        el.style.backgroundColor = '#10b981';
        el.style.border = '2px solid rgba(255,255,255,0.25)';
        el.style.cursor = 'pointer';

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px 2px;">
            <div style="font-weight: 600; font-size: 13px; color: #f9fafb; margin-bottom: 2px;">${harbour.name}</div>
            <div style="font-size: 11px; color: #9ca3af;">${harbour.country} · ${harbour.type}</div>
          </div>
        `;

        const popup = new mapboxgl.Popup({ offset: 10, closeButton: false })
          .setHTML(popupHtml);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([harbour.location.lng, harbour.location.lat])
          .setPopup(popup)
          .addTo(map);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.addTo(map);
        });

        markersRef.current.push(marker);
      }

      // --- Fetch road routes sequentially after map is ready ---
      fetchRoadRoutesSequentially(map);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Build a deduplicated list of mine→harbour pairs from listings,
   * then fetch Mapbox Directions routes sequentially to avoid rate limiting.
   * Results are cached in roadRouteCacheRef.
   */
  async function fetchRoadRoutesSequentially(map: mapboxgl.Map) {
    // If already cached, just render
    if (roadRouteCacheRef.current.length > 0) {
      renderRoadRoutes(map, roadRouteCacheRef.current);
      return;
    }

    // Deduplicate mine→harbour pairs using listings + harbours lookup
    const seen = new Set<string>();
    const pairs: Array<{ mine: MineWithGeo; harbour: HarbourWithGeo }> = [];

    for (const listing of listings) {
      const mine = mines.find((m) => m.id === listing.source_mine_id);
      const harbour = harbours.find((h) => h.id === listing.loading_port_id);
      if (!mine || !harbour) continue;

      const key = `${mine.id}:${harbour.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ mine, harbour });
    }

    const segments: RouteSegment[] = [];

    for (const { mine, harbour } of pairs) {
      const segment = await fetchRoadRoute(
        mine.location,
        harbour.location,
        `${mine.name} → ${harbour.name}`
      );
      if (segment) {
        segments.push(segment);
      }
      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    roadRouteCacheRef.current = segments;
    renderRoadRoutes(map, segments);
  }

  function renderRoadRoutes(map: mapboxgl.Map, segments: RouteSegment[]) {
    const source = map.getSource('road-routes') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const features: GeoJSON.Feature<GeoJSON.LineString>[] = segments.map((seg) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: seg.coordinates },
      properties: { label: seg.label, distance_km: seg.distance_km },
    }));

    source.setData({ type: 'FeatureCollection', features });
  }

  function renderOceanRoute(map: mapboxgl.Map, listing: ListingWithDetails) {
    const harbour = harbours.find((h) => h.id === listing.loading_port_id);
    const from = harbour ? harbour.location : listing.mine_location;

    const segment = generateOceanRoute(
      from,
      SHANGHAI,
      `${listing.harbour_name} → Shanghai`
    );

    const source = map.getSource('ocean-routes') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: segment.coordinates },
          properties: { label: segment.label, distance_km: segment.distance_km },
        },
      ],
    });
  }

  function clearOceanRoute() {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('ocean-routes') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData({ type: 'FeatureCollection', features: [] });
  }

  function handleListingHover(id: string | null) {
    setHoveredListingId(id);

    if (!mapRef.current) return;

    if (!id) {
      clearOceanRoute();
      return;
    }

    const listing = listings.find((l) => l.id === id);
    if (!listing) return;

    mapRef.current.easeTo({
      center: [listing.mine_location.lng, listing.mine_location.lat],
      duration: 400,
    });
  }

  function handleListingClick(listing: ListingWithDetails) {
    if (!mapRef.current) return;

    mapRef.current.flyTo({
      center: [listing.mine_location.lng, listing.mine_location.lat],
      zoom: 8,
      duration: 1000,
    });

    renderOceanRoute(mapRef.current, listing);
  }

  return (
    <div className="relative h-[calc(100vh-5rem)] -m-6 md:-m-10 overflow-hidden flex flex-col">
      {/* Filter bar at top - full width, frosted glass */}
      <div className="relative z-20 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          listingCount={filteredListings.length}
        />
      </div>

      {/* Map + listings panel below the filter bar */}
      <div className="relative flex-1">
        {/* Full-width map behind everything */}
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Left overlay: frosted glass listings panel */}
        <div className="absolute inset-y-0 left-0 w-2/5 min-w-0 flex flex-col z-10 bg-gray-950/85 backdrop-blur-xl border-r border-gray-800/50 overflow-y-auto">
          <ListingsPanel
            listings={filteredListings}
            hoveredListingId={hoveredListingId}
            onListingHover={handleListingHover}
            onListingClick={handleListingClick}
          />
        </div>

        {/* Legend overlay bottom-right of map area */}
        <div className="absolute bottom-8 right-3 z-10 bg-gray-950/80 border border-gray-700/50 rounded-lg p-3 space-y-2 text-xs backdrop-blur-md">
          <div className="text-gray-400 font-semibold uppercase tracking-wider mb-1">Legend</div>
          {(Object.entries(COMMODITY_CONFIG) as [CommodityType, { label: string; color: string }][]).map(
            ([, config]) => (
              <div key={config.label} className="flex items-center gap-2 text-gray-300">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-none"
                  style={{ backgroundColor: config.color }}
                />
                {config.label}
              </div>
            )
          )}
          <div className="flex items-center gap-2 text-gray-300 pt-1 border-t border-gray-700/50">
            <span className="w-2.5 h-2.5 rounded flex-none bg-emerald-500" />
            Harbour
          </div>
          <div className="pt-1 border-t border-gray-700/50 space-y-1.5">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="flex-none w-5 h-0.5 rounded" style={{ backgroundColor: '#f59e0b' }} />
              Road haul
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <span
                className="flex-none w-5 h-0.5 rounded"
                style={{
                  background: `repeating-linear-gradient(to right, #3b82f6 0, #3b82f6 4px, transparent 4px, transparent 7px)`,
                }}
              />
              Ocean freight
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
