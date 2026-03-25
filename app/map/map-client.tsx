'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import Link from 'next/link';
import { COMMODITY_CONFIG, MineWithGeo, HarbourWithGeo, ListingWithDetails, CommodityType } from '@/lib/types';
import { fetchRoadRoute, generateOceanRoute, RouteSegment } from '@/lib/routes';
import type { RouteRow } from '@/lib/queries';
import { TRANSNET_RAIL_NETWORK, RAIL_COLORS, RAIL_WIDTHS, RAIL_LABELS, type RailLine } from '@/lib/transnet-rail';
import { MAP_CONFIG } from '@/lib/constants';
import { COMMODITY_CORRIDORS, type CommodityCorridor } from '@/lib/commodity-corridors';
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

// Commodity-specific destination ports
const COMMODITY_DESTINATIONS: Record<string, { name: string; lng: number; lat: number }> = {
  chrome: { name: 'Qinzhou', lng: 108.647, lat: 21.683 },
  manganese: { name: 'Qingdao', lng: 120.383, lat: 36.067 },
  iron_ore: { name: 'Kashima', lng: 140.617, lat: 35.900 },
  coal: { name: 'Mundra', lng: 69.566, lat: 22.748 },
};

function getPrimarySpec(commodity: string, spec: Record<string, number>): string {
  const keys: Record<string, string[]> = {
    chrome: ['cr2o3_pct', 'cr2o3', 'Cr2O3'],
    manganese: ['mn_pct', 'mn', 'Mn'],
    iron_ore: ['fe_pct', 'fe', 'Fe'],
    coal: ['cv_kcal', 'cv_gar', 'CV'],
    aggregates: ['particle_size_mm', 'size_mm'],
  };
  const searchKeys = keys[commodity] || [];
  for (const k of searchKeys) {
    if (spec[k] !== undefined) {
      const val = spec[k];
      if (commodity === 'coal') return `${val} kcal`;
      return `${val}%`;
    }
  }
  // Fallback: first non-moisture value
  const entry = Object.entries(spec).find(([k]) => !k.includes('moisture'));
  return entry ? `${entry[1]}%` : '';
}

interface MapClientProps {
  mines: MineWithGeo[];
  harbours: HarbourWithGeo[];
  listings: ListingWithDetails[];
  routes: RouteRow[];
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export function MapClient({ mines, harbours, listings, routes }: MapClientProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const roadRouteCacheRef = useRef<RouteSegment[]>([]);
  const mapReadyRef = useRef(false);
  const [hoveredListingId, setHoveredListingId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<ListingWithDetails | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const highlightMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [selectedHarbour, setSelectedHarbour] = useState<HarbourWithGeo | null>(null);
  const [selectedRailLine, setSelectedRailLine] = useState<RailLine | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<CommodityCorridor | null>(null);
  const [layers, setLayers] = useState({
    mines: true,
    ports: true,
    corridors: true,
    roads: true,
    ocean: true,
  });
  const mineMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const harbourMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const corridorSourcesRef = useRef<string[]>([]);
  const savedViewRef = useRef<{ center: [number, number]; zoom: number; pitch: number } | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const filteredListings = applyFilters(listings, filters);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: MAP_CONFIG.SA_CENTER as [number, number],
      zoom: MAP_CONFIG.SA_ZOOM,
    });

    mapRef.current = map;

    // Navigation controls bottom-right
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

    map.on('style.load', () => {
      mapReadyRef.current = true;

      // --- OpenStreetMap Rail Network (background — full network, subtle) ---
      fetch('/za-railways.geojson')
        .then((res) => res.json())
        .then((geojson) => {
          if (!map.getSource('osm-rail-bg')) {
            map.addSource('osm-rail-bg', { type: 'geojson', data: geojson });
            map.addLayer({
              id: 'osm-rail-bg-layer',
              type: 'line',
              source: 'osm-rail-bg',
              paint: { 'line-color': '#475569', 'line-width': 0.8, 'line-opacity': 0.3 },
            });
          }
        })
        .catch(() => {});

      // --- Classified freight corridors with REAL OSM track geometry ---
      // Map corridor IDs from rail-corridors.json to Transnet classifications
      const corridorMapping: Record<string, { classification: string; transnetName: string }> = {
        orex: { classification: 'heavyhaul30t', transnetName: 'OREX Line — Sishen to Saldanha' },
        coallink: { classification: 'heavyhaul26t', transnetName: 'Coal Line — Ermelo to Richards Bay' },
        manganese: { classification: 'heavyhaul26t', transnetName: 'Manganese Corridor — Hotazel to Ngqura' },
        waterberg: { classification: 'heavyhaul26t', transnetName: 'Waterberg Line — Lephalale to Ogies' },
        container: { classification: 'mainline20t', transnetName: 'Container Corridor — Durban to Johannesburg' },
        maputo: { classification: 'mainline20t', transnetName: 'Maputo Corridor — Pretoria to Komatipoort' },
        steelpoort: { classification: 'mainline20t', transnetName: 'Steelpoort Branch — Chrome' },
        phalaborwa: { classification: 'mainline20t', transnetName: 'Phalaborwa Branch' },
        cape: { classification: 'mainline20t', transnetName: 'Cape Corridor — Kimberley to Cape Town' },
        randnatal: { classification: 'mainline20t', transnetName: 'Rand-Natal Line' },
        capenatal: { classification: 'mainline20t', transnetName: 'Cape-Natal Cross Line' },
        central: { classification: 'mainline20t', transnetName: 'Central Corridor Network' },
        northern: { classification: 'mainline20t', transnetName: 'Northern Line' },
      };

      fetch('/rail-corridors.json')
        .then((res) => res.json())
        .then((corridorData: Record<string, { lines: [number, number][][]; count: number }>) => {
          // Group by classification
          const byClass: Record<string, GeoJSON.Feature<GeoJSON.MultiLineString>[]> = {};

          for (const [id, geom] of Object.entries(corridorData)) {
            const mapping = corridorMapping[id];
            if (!mapping) continue;
            const cls = mapping.classification;
            if (!byClass[cls]) byClass[cls] = [];

            byClass[cls].push({
              type: 'Feature',
              geometry: { type: 'MultiLineString', coordinates: geom.lines },
              properties: { name: mapping.transnetName, classification: cls },
            });
          }

          // Also add KML-only corridors not in OSM (Waterberg, Steelpoort, Maputo, Phalaborwa, Central)
          const kmlOnly = TRANSNET_RAIL_NETWORK.filter(l =>
            !Object.values(corridorMapping).some(m => m.transnetName === l.name)
          );
          for (const line of kmlOnly) {
            const cls = line.classification;
            if (!byClass[cls]) byClass[cls] = [];
            byClass[cls].push({
              type: 'Feature',
              geometry: { type: 'MultiLineString', coordinates: [line.coordinates] },
              properties: { name: line.name, classification: cls },
            });
          }

          // Render each classification as a layer
          const classifications = ['heavyhaul30t', 'heavyhaul26t', 'mainline20t'] as const;
          for (const cls of classifications) {
            const features = byClass[cls] || [];
            if (features.length === 0) continue;

            map.addSource(`rail-${cls}`, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features },
            });

            map.addLayer({
              id: `rail-${cls}-layer`,
              type: 'line',
              source: `rail-${cls}`,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': RAIL_COLORS[cls],
                'line-width': RAIL_WIDTHS[cls],
                'line-opacity': 0.75,
                'line-dasharray': [8, 4], // Dashed for rail
              },
            });

            // Click handler
            map.on('click', `rail-${cls}-layer`, (e) => {
              if (e.features && e.features[0]) {
                const name = e.features[0].properties?.name;
                const railLine = TRANSNET_RAIL_NETWORK.find((l) => l.name === name);
                if (railLine) openRailDetail(railLine);
              }
            });

            map.on('mouseenter', `rail-${cls}-layer`, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', `rail-${cls}-layer`, () => { map.getCanvas().style.cursor = ''; });
          }
        })
        .catch(() => {
          // Fallback: use KML data if OSM corridors fail to load
          const classifications = ['heavyhaul30t', 'heavyhaul26t', 'mainline20t'] as const;
          for (const cls of classifications) {
            const lines = TRANSNET_RAIL_NETWORK.filter((l) => l.classification === cls);
            const features: GeoJSON.Feature<GeoJSON.MultiLineString>[] = lines.map((line) => ({
              type: 'Feature',
              geometry: { type: 'MultiLineString', coordinates: [line.coordinates] },
              properties: { name: line.name, classification: cls },
            }));

            map.addSource(`rail-${cls}`, { type: 'geojson', data: { type: 'FeatureCollection', features } });
            map.addLayer({
              id: `rail-${cls}-layer`,
              type: 'line',
              source: `rail-${cls}`,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': RAIL_COLORS[cls], 'line-width': RAIL_WIDTHS[cls], 'line-opacity': 0.75, 'line-dasharray': [8, 4] },
            });
          }
        });

      // --- Road haul source + layer (dotted, thinner) ---
      map.addSource('road-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'road-routes-layer',
        type: 'line',
        source: 'road-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#6b7280',
          'line-width': 1.5,
          'line-dasharray': [1, 3], // Dotted for road
          'line-opacity': 0.65,
        },
      });

      // --- Ocean freight source + layer (blue dashed) ---
      map.addSource('ocean-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'ocean-routes-layer',
        type: 'line',
        source: 'ocean-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#60a5fa',
          'line-width': 3,
          'line-dasharray': [6, 4],
          'line-opacity': 0.8,
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

        const mineListings = listings.filter((l) => l.source_mine_id === mine.id && l.status === 'active');
        const listingRows = mineListings
          .map((l) => {
            const spec = getPrimarySpec(l.commodity_type, l.spec_sheet);
            const vol = l.volume_tonnes >= 1000
              ? `${(l.volume_tonnes / 1000).toFixed(0)}kt`
              : `${l.volume_tonnes}t`;
            const label = COMMODITY_CONFIG[l.commodity_type as CommodityType]?.label ?? l.commodity_type;
            return `<div style="font-size:11px;color:#d1d5db;margin-top:3px;">• ${label}${spec ? ` ${spec}` : ''} — <span style="color:#fbbf24">$${l.price_per_tonne}/t</span> — ${vol}</div>`;
          })
          .join('');

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px 2px; min-width: 180px;">
            <div style="font-weight: 600; font-size: 13px; color: #f9fafb; margin-bottom: 2px;">${mine.name}</div>
            <div style="font-size: 11px; color: #9ca3af;">${mine.region}, ${mine.country}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">
              ${mine.commodities.map((c) => COMMODITY_CONFIG[c as CommodityType]?.label ?? c).join(' · ')}
            </div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
              <div style="font-size: 11px; color: #6b7280;">${mineListings.length} active listing${mineListings.length !== 1 ? 's' : ''}${mineListings.length > 0 ? ':' : ''}</div>
              ${listingRows}
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
        mineMarkersRef.current.push(marker);
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

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([harbour.location.lng, harbour.location.lat])
          .addTo(map);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          openHarbourDetail(harbour);
        });

        markersRef.current.push(marker);
        harbourMarkersRef.current.push(marker);
      }

      // --- Dynamic zoom-based marker sizing ---
      function updateMarkerSizes() {
        const zoom = map.getZoom();
        // Scale: zoom 3=8px, zoom 5=12px, zoom 7=16px, zoom 10=22px
        const mineSize = Math.max(4, Math.min(20, 2 + zoom * 2));
        const portSize = Math.max(4, Math.min(18, 2 + zoom * 1.8));

        mineMarkersRef.current.forEach(m => {
          const el = m.getElement();
          el.style.width = `${mineSize}px`;
          el.style.height = `${mineSize}px`;
        });

        harbourMarkersRef.current.forEach(m => {
          const el = m.getElement();
          el.style.width = `${portSize}px`;
          el.style.height = `${portSize}px`;
        });
      }

      map.on('zoom', updateMarkerSizes);
      // Initial sizing
      updateMarkerSizes();

      // --- Fetch road routes from Mapbox Directions API ---
      fetchRoadRoutesSequentially(map);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mineMarkersRef.current = [];
      harbourMarkersRef.current = [];
      mapReadyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Build a deduplicated list of road mine→harbour pairs from routes data,
   * then fetch Mapbox Directions routes sequentially to avoid rate limiting.
   * Results are cached in roadRouteCacheRef.
   */
  async function fetchRoadRoutesSequentially(map: mapboxgl.Map) {
    // If already cached, just render
    if (roadRouteCacheRef.current.length > 0) {
      renderRoadRoutes(map, roadRouteCacheRef.current);
      return;
    }

    // Use routes table data for road routes; fall back to listing-derived pairs
    const roadRows = routes.filter((r) => r.transport_mode === 'road');
    const seen = new Set<string>();
    const pairs: Array<{ mine: MineWithGeo; harbour: HarbourWithGeo }> = [];

    if (roadRows.length > 0) {
      for (const row of roadRows) {
        const key = `${row.origin_mine_id}:${row.harbour_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const mine = mines.find((m) => m.id === row.origin_mine_id);
        const harbour = harbours.find((h) => h.id === row.harbour_id);
        if (mine && harbour) pairs.push({ mine, harbour });
      }
    } else {
      // Fallback: derive road pairs from listings
      for (const listing of listings) {
        const mine = mines.find((m) => m.id === listing.source_mine_id);
        const harbour = harbours.find((h) => h.id === listing.loading_port_id);
        if (!mine || !harbour) continue;
        const key = `${mine.id}:${harbour.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({ mine, harbour });
      }
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

    // Aggregates are domestic only — no ocean route
    if (listing.commodity_type === 'aggregates') return;

    const dest = COMMODITY_DESTINATIONS[listing.commodity_type];
    if (!dest) return;

    const segment = generateOceanRoute(
      from,
      dest,
      `${listing.harbour_name} → ${dest.name}`
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
  }

  // Harbour infrastructure data
  const harbourInfo: Record<string, { operator: string; capacity: string; berths: string; commodities: string; depth: string }> = {
    'Richards Bay': { operator: 'Transnet Port Terminals', capacity: '91 Mtpa (RBCT coal terminal)', berths: '4 coal berths, 2 dry bulk, 3 multipurpose', commodities: 'Coal, chrome, iron ore', depth: '17.5m draft' },
    'Saldanha Bay': { operator: 'Transnet Port Terminals', capacity: '60 Mtpa (iron ore terminal)', berths: '1 iron ore berth (342m), 1 multipurpose', commodities: 'Iron ore (93% of SA exports)', depth: '21.5m draft (Cape-size)' },
    'Durban': { operator: 'Transnet Port Terminals', capacity: '31 Mtpa total, 12 Mtpa dry bulk', berths: '57 berths across 7 terminals', commodities: 'Manganese, chrome, containers', depth: '12.8m draft' },
    'Maputo': { operator: 'Grindrod / MPDC', capacity: '7.5 Mtpa (expanding to 20 Mtpa)', berths: '2 bulk berths, 1 container', commodities: 'Chrome ore (49% of SA chrome to China)', depth: '14.0m draft' },
    'Port Ngqura': { operator: 'Transnet Port Terminals', capacity: '16 Mtpa manganese terminal', berths: '2 manganese berths, 2 container', commodities: 'Manganese ore (primary)', depth: '18.0m draft' },
    'Gqeberha': { operator: 'Transnet Port Terminals', capacity: '4 Mtpa manganese', berths: '1 manganese berth, 2 general cargo', commodities: 'Manganese (legacy terminal)', depth: '11.4m draft' },
  };

  function saveView() {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    savedViewRef.current = { center: [center.lng, center.lat], zoom: map.getZoom(), pitch: map.getPitch() };
  }

  function restoreView() {
    const map = mapRef.current;
    if (map && savedViewRef.current) {
      map.flyTo({
        center: savedViewRef.current.center,
        zoom: savedViewRef.current.zoom,
        pitch: savedViewRef.current.pitch,
        duration: 1200,
      });
      savedViewRef.current = null;
    }
  }

  function openHarbourDetail(harbour: HarbourWithGeo) {
    const map = mapRef.current;
    if (!map) return;
    saveView();
    clearSelection();
    setSelectedRailLine(null);
    setSelectedHarbour(harbour);
    map.flyTo({ center: [harbour.location.lng, harbour.location.lat], zoom: 14, duration: 1500, pitch: 45 });
  }

  function closeHarbourDetail() {
    setSelectedHarbour(null);
    restoreView();
  }

  function openRailDetail(line: RailLine) {
    const map = mapRef.current;
    if (!map) return;
    saveView();
    clearSelection();
    setSelectedHarbour(null);
    setSelectedRailLine(line);

    // Fit to rail line bounds
    const lngs = line.coordinates.map((c) => c[0]);
    const lats = line.coordinates.map((c) => c[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 100, bottom: 60, left: panelWidth + 40, right: 80 }, duration: 1200 }
    );
  }

  function closeRailDetail() {
    setSelectedRailLine(null);
    restoreView();
  }

  // Render commodity corridors on the map
  async function renderCorridors() {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    // Clear existing corridor layers
    clearCorridorLayers();

    for (const corridor of COMMODITY_CORRIDORS) {
      const srcId = `corridor-${corridor.id}`;
      const layerId = `corridor-${corridor.id}-layer`;

      if (corridor.mode === 'road' && corridor.roadWaypoints) {
        // Fetch real road geometry from Mapbox Directions API
        const wp = corridor.roadWaypoints;
        const coordStr = wp.map(([lng, lat]) => `${lng},${lat}`).join(';');
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        try {
          const res = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${token}`
          );
          if (res.ok) {
            const data = await res.json();
            const route = data.routes?.[0];
            if (route) {
              map.addSource(srcId, {
                type: 'geojson',
                data: {
                  type: 'Feature',
                  geometry: route.geometry,
                  properties: { name: corridor.name, volume: corridor.volume_mtpa },
                },
              });

              map.addLayer({
                id: layerId,
                type: 'line',
                source: srcId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                  'line-color': corridor.color,
                  'line-width': Math.max(2, Math.min(6, corridor.volume_mtpa / 3)),
                  'line-opacity': 0.7,
                  'line-dasharray': [1, 3], // Dotted for road corridors
                },
              });

              corridorSourcesRef.current.push(srcId);

              // Click handler
              map.on('click', layerId, () => setSelectedCorridor(corridor));
              map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
              map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
            }
          }
        } catch { /* skip failed fetches */ }

        // Small delay between API calls
        await new Promise((r) => setTimeout(r, 200));
      } else if (corridor.mode === 'rail' && corridor.railLineName) {
        // Rail corridors reference existing Transnet lines — highlight them
        const railLine = TRANSNET_RAIL_NETWORK.find((l) => l.name === corridor.railLineName);
        if (railLine) {
          map.addSource(srcId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: railLine.coordinates },
              properties: { name: corridor.name, volume: corridor.volume_mtpa },
            },
          });

          // Wider glow behind the existing rail line to show commodity flow
          map.addLayer({
            id: layerId,
            type: 'line',
            source: srcId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': corridor.color,
              'line-width': Math.max(3, Math.min(8, corridor.volume_mtpa / 4)),
              'line-opacity': 0.4,
              'line-blur': 3,
            },
          });

          corridorSourcesRef.current.push(srcId);

          map.on('click', layerId, () => setSelectedCorridor(corridor));
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        }
      }
    }
  }

  function clearCorridorLayers() {
    const map = mapRef.current;
    if (!map) return;
    for (const srcId of corridorSourcesRef.current) {
      const layerId = `${srcId.replace('corridor-', 'corridor-')}-layer`;
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(srcId)) map.removeSource(srcId);
    }
    corridorSourcesRef.current = [];
  }

  // Layer visibility effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    // Toggle mine markers
    mineMarkersRef.current.forEach(m => {
      m.getElement().style.display = layers.mines ? '' : 'none';
    });

    // Toggle harbour markers
    harbourMarkersRef.current.forEach(m => {
      m.getElement().style.display = layers.ports ? '' : 'none';
    });

    // Toggle rail corridor layers
    const railLayerIds = ['rail-heavyhaul30t-layer', 'rail-heavyhaul26t-layer', 'rail-mainline20t-layer', 'osm-rail-bg-layer'];
    railLayerIds.forEach(id => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', layers.corridors ? 'visible' : 'none');
      }
    });

    // Toggle road routes
    if (map.getLayer('road-routes-layer')) {
      map.setLayoutProperty('road-routes-layer', 'visibility', layers.roads ? 'visible' : 'none');
    }

    // Toggle ocean routes
    if (map.getLayer('ocean-routes-layer')) {
      map.setLayoutProperty('ocean-routes-layer', 'visibility', layers.ocean ? 'visible' : 'none');
    }
  }, [layers]);

  function clearSelection() {
    // Remove highlight markers
    highlightMarkersRef.current.forEach((m) => m.remove());
    highlightMarkersRef.current = [];
    // Remove highlight route line
    const map = mapRef.current;
    if (map) {
      if (map.getLayer('highlight-route')) map.removeLayer('highlight-route');
      if (map.getSource('highlight-route')) map.removeSource('highlight-route');
    }
    clearOceanRoute();
    setSelectedListing(null);
    setPopupPos(null);
  }

  function handleListingClick(listing: ListingWithDetails) {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous selection
    clearSelection();

    setSelectedListing(listing);

    // Find the harbour for this listing
    const harbour = harbours.find((h) => h.id === listing.loading_port_id);
    const harbourLoc = harbour?.location ?? listing.mine_location;
    const mineLoc = listing.mine_location;

    // Fit bounds to show mine and harbour (land route only)
    const sw: [number, number] = [
      Math.min(mineLoc.lng, harbourLoc.lng),
      Math.min(mineLoc.lat, harbourLoc.lat),
    ];
    const ne: [number, number] = [
      Math.max(mineLoc.lng, harbourLoc.lng),
      Math.max(mineLoc.lat, harbourLoc.lat),
    ];
    map.fitBounds([sw, ne], {
      padding: { top: 140, bottom: 60, left: panelWidth + 40, right: 80 },
      maxZoom: 9,
      duration: 1000,
    });

    // Add highlighted pulsing markers at mine (start) and harbour (end)
    const startEl = document.createElement('div');
    startEl.style.cssText = `width:20px;height:20px;border-radius:50%;background:${COMMODITY_CONFIG[listing.commodity_type]?.color ?? '#f59e0b'};border:3px solid white;box-shadow:0 0 12px ${COMMODITY_CONFIG[listing.commodity_type]?.color ?? '#f59e0b'}88;`;
    const startMarker = new mapboxgl.Marker({ element: startEl })
      .setLngLat([mineLoc.lng, mineLoc.lat])
      .addTo(map);

    const endEl = document.createElement('div');
    endEl.style.cssText = 'width:18px;height:18px;border-radius:3px;background:#10b981;border:3px solid white;box-shadow:0 0 12px #10b98188;';
    const endMarker = new mapboxgl.Marker({ element: endEl })
      .setLngLat([harbourLoc.lng, harbourLoc.lat])
      .addTo(map);

    highlightMarkersRef.current = [startMarker, endMarker];

    // Draw highlighted route line between mine and harbour
    map.addSource('highlight-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [[mineLoc.lng, mineLoc.lat], [harbourLoc.lng, harbourLoc.lat]],
        },
        properties: {},
      },
    });
    map.addLayer({
      id: 'highlight-route',
      type: 'line',
      source: 'highlight-route',
      paint: {
        'line-color': '#ffffff',
        'line-width': 3,
        'line-opacity': 0.8,
        'line-dasharray': [2, 2],
      },
    });

    // Position popup at midpoint of mine→harbour after map moves
    setTimeout(() => {
      const midLng = (mineLoc.lng + harbourLoc.lng) / 2;
      const midLat = (mineLoc.lat + harbourLoc.lat) / 2;
      const point = map.project([midLng, midLat]);
      setPopupPos({ x: point.x, y: point.y });
    }, 1100);
  }

  const [panelWidth, setPanelWidth] = useState(380);
  const isDragging = useRef(false);

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;

    function onMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      // Account for sidebar width (224px on md+)
      const sidebarWidth = window.innerWidth >= 768 ? 224 : 0;
      const newWidth = Math.max(280, Math.min(ev.clientX - sidebarWidth, window.innerWidth * 0.6));
      setPanelWidth(newWidth);
    }

    function onUp() {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div className="relative h-[calc(100vh-5rem)] -m-6 md:-m-10 overflow-hidden">
      {/* Map fills ENTIRE area behind everything */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Filter bar - floating at top, transparent */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gray-950/20 backdrop-blur-xl border-b border-white/5">
        <FilterBar
          filters={filters}
          onFiltersChange={setFilters}
          listingCount={filteredListings.length}
        />
      </div>

      {/* Map layers settings panel */}
      <div className="absolute top-[92px] right-4 z-20 bg-gray-950/80 backdrop-blur-xl border border-white/10 rounded-xl p-3 space-y-1.5">
        <p className="text-[10px] uppercase text-gray-500 tracking-wider mb-2">Map Layers</p>
        {[
          { key: 'mines', label: 'Mines', color: '#f59e0b' },
          { key: 'ports', label: 'Ports', color: '#10b981' },
          { key: 'corridors', label: 'Rail Corridors', color: '#f87171' },
          { key: 'roads', label: 'Road Routes', color: '#6b7280' },
          { key: 'ocean', label: 'Ocean Routes', color: '#60a5fa' },
        ].map(({ key, label, color }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={layers[key as keyof typeof layers]}
              onChange={() => setLayers(prev => ({ ...prev, [key]: !prev[key as keyof typeof layers] }))}
              className="sr-only"
            />
            <span className={`w-3 h-3 rounded-sm border transition-colors ${
              layers[key as keyof typeof layers]
                ? 'border-transparent'
                : 'border-gray-600 bg-gray-800'
            }`} style={layers[key as keyof typeof layers] ? { backgroundColor: color } : {}} />
            <span className={`${layers[key as keyof typeof layers] ? 'text-gray-200' : 'text-gray-500'}`}>
              {label}
            </span>
          </label>
        ))}
      </div>

      {/* Corridor detail panel */}
      {selectedCorridor && (
        <div className="absolute top-28 right-4 z-30 bg-gray-950/20 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-72 shadow-2xl">
          <button
            onClick={() => setSelectedCorridor(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
          >×</button>

          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-1 rounded" style={{ backgroundColor: selectedCorridor.color }} />
            <span className="text-[10px] uppercase text-gray-500">
              {selectedCorridor.mode === 'road' ? 'Road Corridor' : 'Rail Corridor'}
            </span>
          </div>

          <h3 className="text-sm font-semibold text-white mb-1">{selectedCorridor.name}</h3>
          <p className="text-xs text-gray-400 mb-3">{selectedCorridor.description}</p>

          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div>
              <span className="text-gray-500">Volume</span>
              <p className="text-white font-semibold">{selectedCorridor.volume_mtpa} Mtpa</p>
            </div>
            <div>
              <span className="text-gray-500">Commodity</span>
              <p className="text-white capitalize">{selectedCorridor.commodity.replace('_', ' ')}</p>
            </div>
            <div>
              <span className="text-gray-500">Source</span>
              <p className="text-gray-200">{selectedCorridor.source}</p>
            </div>
            <div>
              <span className="text-gray-500">Destination</span>
              <p className="text-gray-200">{selectedCorridor.destination}</p>
            </div>
          </div>
        </div>
      )}

      {/* Listings panel - left overlay, transparent, below filter bar */}
      <div
        className="absolute top-[88px] bottom-0 left-0 z-10 flex"
        style={{ width: panelWidth }}
      >
        {/* Panel content */}
        <div className="flex-1 bg-gray-950/20 backdrop-blur-xl border-r border-white/5 overflow-y-auto">
          <ListingsPanel
            listings={filteredListings}
            hoveredListingId={hoveredListingId}
            onListingHover={handleListingHover}
            onListingClick={handleListingClick}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className="w-1.5 cursor-col-resize flex-shrink-0 group relative hover:bg-white/10 transition-colors"
        >
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center">
            <div className="w-0.5 h-8 bg-white/20 rounded-full group-hover:bg-white/40 transition-colors" />
          </div>
        </div>
      </div>

      {/* Listing popup — positioned above the route midpoint on the map */}
      {selectedListing && popupPos && (() => {
        const config = COMMODITY_CONFIG[selectedListing.commodity_type];
        const mainSpec = getPrimarySpec(selectedListing.commodity_type, selectedListing.spec_sheet);
        return (
          <div
            className="absolute z-30 pointer-events-auto"
            style={{ left: popupPos.x, top: popupPos.y, transform: 'translate(-50%, -100%) translateY(-16px)' }}
          >
            <div className="bg-gray-950/30 backdrop-blur-xl border border-white/10 rounded-lg px-3 py-2.5 shadow-2xl w-56">
              {/* Close */}
              <button
                onClick={clearSelection}
                className="absolute -top-2 -right-2 text-gray-400 hover:text-white text-xs w-5 h-5 flex items-center justify-center rounded-full bg-gray-800/80 border border-white/10 hover:bg-gray-700"
              >×</button>

              {/* Commodity + price row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
                  <span className="text-xs font-semibold text-white">
                    {config.label} {mainSpec || ''}
                  </span>
                  {selectedListing.is_verified && (
                    <span className="text-[9px] text-emerald-400">✓</span>
                  )}
                </div>
                <span className="text-xs font-bold text-amber-400">${selectedListing.price_per_tonne}/t</span>
              </div>

              {/* Route + volume */}
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1.5">
                <span>{selectedListing.mine_name} → {selectedListing.harbour_name}</span>
                <span>{selectedListing.volume_tonnes >= 1000 ? `${(selectedListing.volume_tonnes / 1000).toFixed(0)}kt` : `${selectedListing.volume_tonnes}t`}</span>
              </div>

              {/* Incoterms */}
              <div className="flex gap-1 mb-2">
                {selectedListing.incoterms.map((t) => (
                  <span key={t} className="text-[9px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-1.5">
                <Link
                  href={`/marketplace/listings/${selectedListing.id}`}
                  className="flex-1 text-center text-[10px] bg-white/90 text-black rounded px-2 py-1 font-medium hover:bg-white transition-colors"
                >
                  Details
                </Link>
                <button className="flex-1 text-center text-[10px] bg-white/10 text-white rounded px-2 py-1 font-medium hover:bg-white/20 transition-colors border border-white/10">
                  Interest
                </button>
              </div>
            </div>
            {/* Arrow pointing down to route */}
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-gray-950/30 border-r border-b border-white/10 rotate-45 -mt-1 backdrop-blur-xl" />
            </div>
          </div>
        );
      })()}

      {/* Harbour detail panel — zoomed-in view with infrastructure info */}
      {selectedHarbour && (() => {
        const info = harbourInfo[selectedHarbour.name];
        return (
          <div className="absolute top-24 right-4 z-30 bg-gray-950/20 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-72 shadow-2xl">
            <button
              onClick={closeHarbourDetail}
              className="absolute top-2 right-2 text-gray-400 hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
            >×</button>

            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-sm bg-emerald-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-white">{selectedHarbour.name}</span>
              <span className="text-[10px] text-gray-500">{selectedHarbour.country}</span>
            </div>

            <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">
              {selectedHarbour.type === 'loading' ? 'Loading Port' : 'Destination Port'}
            </div>

            {info ? (
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500">Operator</span>
                  <p className="text-gray-200">{info.operator}</p>
                </div>
                <div>
                  <span className="text-gray-500">Capacity</span>
                  <p className="text-gray-200">{info.capacity}</p>
                </div>
                <div>
                  <span className="text-gray-500">Berths</span>
                  <p className="text-gray-200">{info.berths}</p>
                </div>
                <div>
                  <span className="text-gray-500">Primary Commodities</span>
                  <p className="text-gray-200">{info.commodities}</p>
                </div>
                <div>
                  <span className="text-gray-500">Max Draft</span>
                  <p className="text-gray-200">{info.depth}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Infrastructure details not available for this port.</p>
            )}

            <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-gray-500">
              Zoomed to berth level · Click × to return
            </div>
          </div>
        );
      })()}

      {/* Rail line detail panel */}
      {selectedRailLine && (
        <div className="absolute top-24 right-4 z-30 bg-gray-950/20 backdrop-blur-xl border border-white/10 rounded-xl p-4 w-80 shadow-2xl">
          <button
            onClick={closeRailDetail}
            className="absolute top-2 right-2 text-gray-400 hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
          >×</button>

          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-1 rounded" style={{ backgroundColor: RAIL_COLORS[selectedRailLine.classification] }} />
            <span className="text-xs text-gray-500">{RAIL_LABELS[selectedRailLine.classification]}</span>
          </div>

          <h3 className="text-sm font-semibold text-white mb-1">{selectedRailLine.name}</h3>
          <p className="text-xs text-gray-400 mb-3">{selectedRailLine.description}</p>

          <div className="space-y-2 text-xs">
            <div><span className="text-gray-500">Length</span><p className="text-gray-200">{selectedRailLine.length_km} km</p></div>
            <div><span className="text-gray-500">Capacity</span><p className="text-gray-200">{selectedRailLine.capacity}</p></div>
            <div><span className="text-gray-500">Commodities</span><p className="text-gray-200">{selectedRailLine.commodities}</p></div>
            <div><span className="text-gray-500">Operator</span><p className="text-gray-200">{selectedRailLine.operator}</p></div>
            <div><span className="text-gray-500">Electrification</span><p className="text-gray-200">{selectedRailLine.electrification}</p></div>
          </div>

          <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-gray-500">
            Click × to return to previous view
          </div>
        </div>
      )}

      {/* Legend overlay bottom-left of map area */}
        <div className="absolute bottom-8 left-3 z-10 bg-gray-950/20 border border-white/5 rounded-lg p-3 space-y-2 text-xs backdrop-blur-xl">
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
            {Object.entries(RAIL_LABELS).map(([cls, label]) => (
              <div key={cls} className="flex items-center gap-2 text-gray-300">
                <span className="flex-none w-5 rounded" style={{ backgroundColor: RAIL_COLORS[cls], height: RAIL_WIDTHS[cls] }} />
                {label}
              </div>
            ))}
            <div className="flex items-center gap-2 text-gray-300">
              <span className="flex-none w-5 h-0.5 rounded" style={{ background: 'repeating-linear-gradient(to right, #6b7280 0, #6b7280 4px, transparent 4px, transparent 8px)' }} />
              Road haul
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <span className="flex-none w-5 h-0.5 rounded" style={{ background: 'repeating-linear-gradient(to right, #3b82f6 0, #3b82f6 4px, transparent 4px, transparent 7px)' }} />
              Ocean freight
            </div>
          </div>
      </div>
    </div>
  );
}
