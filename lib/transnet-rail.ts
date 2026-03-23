/**
 * Transnet Freight Rail network data parsed from official KML.
 * Coordinates are [lng, lat] pairs.
 */

export interface RailLine {
  name: string;
  classification: 'heavyhaul30t' | 'heavyhaul26t' | 'mainline20t' | 'branchline18t';
  coordinates: [number, number][];
  description: string;
  capacity: string;
  commodities: string;
  operator: string;
  electrification: string;
  length_km: number;
}

export const TRANSNET_RAIL_NETWORK: RailLine[] = [
  {
    name: 'OREX Line — Sishen to Saldanha',
    classification: 'heavyhaul30t',
    coordinates: [
      [23.0125, -27.775], [22.5, -28.0], [21.8, -28.5], [21.5, -28.8],
      [21.0, -29.2], [20.5, -29.8], [19.8, -30.5], [19.0, -31.0],
      [18.5, -31.5], [18.0, -32.5], [17.9442, -33.0142],
    ],
    description: 'World-class heavy haul. 375-wagon trains (4 km long, 41,400t gross). Single track with 19 passing loops.',
    capacity: '60+ Mtpa iron ore',
    commodities: 'Iron ore, manganese, cement',
    operator: 'Transnet Freight Rail (OreCor)',
    electrification: '50kV AC (unique in SA)',
    length_km: 861,
  },
  {
    name: 'Coal Line — Ermelo to Richards Bay',
    classification: 'heavyhaul26t',
    coordinates: [
      [29.9833, -26.5167], [30.2, -27.0], [30.5, -27.5],
      [31.0, -28.0], [31.5, -28.5], [32.0378, -28.7831],
    ],
    description: 'Double track, bi-directional. 200-wagon trains (2.5 km). Dual electrification with loco change at Ermelo.',
    capacity: '91 Mtpa design, ~52 Mtpa actual (2024)',
    commodities: 'Export coal, chrome, ferrochrome',
    operator: 'Transnet Freight Rail (North Corridor)',
    electrification: '3kV DC (north) / 25kV AC (south)',
    length_km: 580,
  },
  {
    name: 'Waterberg Line — Lephalale to Ogies',
    classification: 'heavyhaul26t',
    coordinates: [
      [27.6833, -23.6667], [28.0, -24.5], [28.5, -25.0],
      [29.0, -25.5], [29.0333, -26.05],
    ],
    description: 'Feeds Medupi/Matimba power stations. 100-wagon trains. Being upgraded for increased capacity.',
    capacity: '6 Mtpa current, 12+ Mtpa target',
    commodities: 'Thermal coal',
    operator: 'Transnet Freight Rail',
    electrification: '25kV AC',
    length_km: 438,
  },
  {
    name: 'Manganese Corridor — Hotazel to Ngqura',
    classification: 'heavyhaul26t',
    coordinates: [
      [22.9667, -27.2], [23.5, -28.0], [24.7711, -28.7381],
      [24.0, -30.0], [24.0167, -31.05], [25.5, -32.0],
      [26.0, -33.0], [25.6167, -33.9667],
    ],
    description: 'Third heavy haul line. Dual-system locos. 104-125 wagon trains. R10.8bn upgrade (2012-2019).',
    capacity: '15-17 Mtpa current, 21 Mtpa target',
    commodities: 'Manganese ore, chrome, iron ore (domestic)',
    operator: 'Transnet Freight Rail (CapeCor)',
    electrification: '3kV DC (north) / 25kV AC (south)',
    length_km: 1003,
  },
  {
    name: 'Container Corridor — Durban to Johannesburg',
    classification: 'mainline20t',
    coordinates: [
      [31.0292, -29.8675], [30.4, -29.6], [29.9, -29.3],
      [29.6, -28.5], [29.8, -27.8], [28.8, -27.0], [28.0442, -26.2044],
    ],
    description: 'Backbone of SA container freight. Seeking private 20-year operating lease. Transit time: 28-37 hours.',
    capacity: '47 trains/direction/day (theoretical)',
    commodities: 'Containers, fuel, grain, motor vehicles',
    operator: 'Transnet Freight Rail (ContainerCor)',
    electrification: '3kV DC / 25kV AC',
    length_km: 688,
  },
  {
    name: 'Maputo Corridor — Pretoria to Komatipoort',
    classification: 'mainline20t',
    coordinates: [
      [28.1878, -25.7461], [29.0, -25.8], [29.9, -25.9],
      [30.5, -25.5], [31.3, -25.4], [31.9472, -25.4333],
    ],
    description: 'Strategic link to Mozambique. Chrome, magnetite, phosphate exports. 21-24 trains/week to Maputo.',
    capacity: '14% of TFR volumes',
    commodities: 'Chrome ore, ferrochrome, magnetite, coal',
    operator: 'Transnet Freight Rail (NorthEastCor)',
    electrification: '25kV AC',
    length_km: 450,
  },
  {
    name: 'Phalaborwa Branch',
    classification: 'mainline20t',
    coordinates: [
      [31.1417, -23.9428], [30.8, -24.3], [30.5, -24.8],
      [30.2, -25.2], [31.3, -25.4],
    ],
    description: 'Rock phosphate (Foskor), magnetite, copper. Connects to Maputo Corridor.',
    capacity: '3.8 Mtpa (phosphate + magnetite)',
    commodities: 'Rock phosphate, magnetite, copper, vermiculite',
    operator: 'Transnet / Palabora Mining',
    electrification: '25kV AC',
    length_km: 180,
  },
  {
    name: 'Steelpoort Branch — Chrome',
    classification: 'mainline20t',
    coordinates: [
      [30.0333, -24.9833], [30.2, -25.3], [30.1, -25.7], [30.0417, -25.7],
    ],
    description: 'Eastern Bushveld chrome mines. Serves Samancor, Glencore-Merafe, Dwarsrivier (Assmang).',
    capacity: 'Multiple mine loading points',
    commodities: 'Chrome ore, ferrochrome, PGMs',
    operator: 'Transnet Freight Rail',
    electrification: '25kV AC',
    length_km: 100,
  },
  {
    name: 'Cape Corridor — Kimberley to Cape Town',
    classification: 'mainline20t',
    coordinates: [
      [24.7711, -28.7381], [24.0, -30.0], [24.0167, -31.05],
      [22.5, -32.0], [20.0, -33.0], [18.4241, -33.9249],
    ],
    description: 'Largest geographic footprint. Spans 4 provinces (NC, WC, EC, FS).',
    capacity: 'Multi-commodity general freight',
    commodities: 'Manganese, iron ore, containers, cement, grain',
    operator: 'Transnet Freight Rail (CapeCor)',
    electrification: '25kV AC',
    length_km: 950,
  },
  {
    name: 'Central Corridor Network',
    classification: 'mainline20t',
    coordinates: [
      [25.6333, -26.1333], [26.5, -26.5], [27.0, -26.3], [28.0, -26.2],
    ],
    description: 'Hub connecting 5 other corridors. Serves maize triangle, automotive sector, Botswana link.',
    capacity: 'Hub/interchange',
    commodities: 'Grain, automotive, containers, manufacturing',
    operator: 'Transnet Freight Rail (CentralCor)',
    electrification: '3kV DC',
    length_km: 300,
  },
];

// Color scheme by classification
export const RAIL_COLORS: Record<string, string> = {
  heavyhaul30t: '#dc2626', // Red — world class heavy haul
  heavyhaul26t: '#f59e0b', // Amber — heavy haul
  mainline20t: '#3b82f6',  // Blue — main line
  branchline18t: '#6b7280', // Gray — branch line
};

export const RAIL_WIDTHS: Record<string, number> = {
  heavyhaul30t: 4,
  heavyhaul26t: 3,
  mainline20t: 2,
  branchline18t: 1.5,
};

export const RAIL_LABELS: Record<string, string> = {
  heavyhaul30t: 'Heavy Haul 30t',
  heavyhaul26t: 'Heavy Haul 26t',
  mainline20t: 'Main Line 20t',
  branchline18t: 'Branch Line 18t',
};
