/**
 * Named commodity transport corridors with volume estimates.
 * Each corridor represents a specific commodity flow from source region to port.
 */

import type { CommodityType } from './types';

export interface CommodityCorridor {
  id: string;
  name: string;
  commodity: CommodityType;
  mode: 'road' | 'rail';
  source: string;        // Region/mine cluster name
  destination: string;   // Port name
  volume_mtpa: number;   // Estimated annual volume in million tonnes
  description: string;
  /** For road corridors: key waypoint towns [lng, lat] to fetch Mapbox directions between */
  roadWaypoints?: [number, number][];
  /** For rail corridors: reference the Transnet rail line name */
  railLineName?: string;
  color: string;
}

// Road corridor colors — distinct from rail
const CHROME_ROAD = '#f97316';   // Orange
const CHROME_RAIL = '#f59e0b';   // Amber
const MN_RAIL = '#a78bfa';       // Purple
const MN_ROAD = '#c084fc';       // Light purple
const FE_RAIL = '#ef4444';       // Red
const COAL_RAIL = '#6b7280';     // Gray
const COAL_ROAD = '#9ca3af';     // Light gray

export const COMMODITY_CORRIDORS: CommodityCorridor[] = [
  // ==========================================
  // CHROME CORRIDORS (~17 Mtpa total export)
  // ==========================================
  {
    id: 'chrome-wl-road-rb',
    name: 'Western Limb Chrome Road Corridor',
    commodity: 'chrome',
    mode: 'road',
    source: 'Rustenburg / North West',
    destination: 'Richards Bay',
    volume_mtpa: 4.5,
    description: 'UG2 concentrate and lumpy chrome from Rustenburg-area mines trucked via N4/N17/N2 to Richards Bay. ~520km, 8-10 hour transit.',
    roadWaypoints: [
      [27.35, -25.67],   // Rustenburg area
      [28.23, -25.75],   // Pretoria bypass
      [29.23, -25.87],   // eMalahleni
      [29.98, -26.52],   // Ermelo
      [30.82, -27.77],   // Vryheid
      [32.04, -28.78],   // Richards Bay
    ],
    color: CHROME_ROAD,
  },
  {
    id: 'chrome-el-rail-rb',
    name: 'Eastern Limb Chrome Rail Corridor',
    commodity: 'chrome',
    mode: 'rail',
    source: 'Steelpoort / Eastern Bushveld',
    destination: 'Richards Bay',
    volume_mtpa: 3.0,
    description: 'Chrome from Steelpoort Valley mines (Dwarsrivier, Helena, Thorncliffe) railed via Belfast junction onto COALlink to Richards Bay.',
    railLineName: 'Steelpoort Branch — Chrome',
    color: CHROME_RAIL,
  },
  {
    id: 'chrome-el-road-maputo',
    name: 'Eastern Limb Chrome Road to Maputo',
    commodity: 'chrome',
    mode: 'road',
    source: 'Steelpoort / Eastern Bushveld',
    destination: 'Maputo',
    volume_mtpa: 2.5,
    description: 'Chrome trucked via N4 Maputo Corridor through Nelspruit and Komatipoort to Maputo port. Preferred for China-bound cargo.',
    roadWaypoints: [
      [30.10, -24.98],   // Steelpoort
      [30.97, -25.48],   // Nelspruit/Mbombela
      [31.95, -25.43],   // Komatipoort
      [32.59, -25.95],   // Maputo
    ],
    color: CHROME_ROAD,
  },
  {
    id: 'chrome-wl-road-maputo',
    name: 'Western Limb Chrome Road to Maputo',
    commodity: 'chrome',
    mode: 'road',
    source: 'Rustenburg / North West',
    destination: 'Maputo',
    volume_mtpa: 3.5,
    description: '49% of China-bound chrome routes via Maputo. Trucks take N4 from Rustenburg through Pretoria, Nelspruit, Komatipoort.',
    roadWaypoints: [
      [27.35, -25.67],   // Rustenburg
      [28.23, -25.75],   // Pretoria
      [30.97, -25.48],   // Nelspruit
      [31.95, -25.43],   // Komatipoort
      [32.59, -25.95],   // Maputo
    ],
    color: CHROME_ROAD,
  },
  {
    id: 'chrome-north-road-maputo',
    name: 'Northern Limpopo Chrome Road to Maputo',
    commodity: 'chrome',
    mode: 'road',
    source: 'Mecklenburg / Northern Limpopo',
    destination: 'Maputo',
    volume_mtpa: 1.5,
    description: 'Chrome from northern Limpopo mines (Mecklenburg, Vlakpoort) trucked south via N1 to Pretoria then N4 to Maputo.',
    roadWaypoints: [
      [29.58, -24.20],   // Mecklenburg
      [28.23, -25.75],   // Pretoria
      [30.97, -25.48],   // Nelspruit
      [31.95, -25.43],   // Komatipoort
      [32.59, -25.95],   // Maputo
    ],
    color: CHROME_ROAD,
  },
  {
    id: 'chrome-maputo-rail',
    name: 'Maputo Rail Corridor — Chrome',
    commodity: 'chrome',
    mode: 'rail',
    source: 'Bushveld Complex',
    destination: 'Maputo',
    volume_mtpa: 2.0,
    description: 'Chrome railed on NorthEast Corridor through Komatipoort to Maputo. 21-24 trains/week available, currently underutilized.',
    railLineName: 'Maputo Corridor — Pretoria to Komatipoort',
    color: CHROME_RAIL,
  },

  // ==========================================
  // MANGANESE CORRIDORS (~24 Mtpa total, rail constrained)
  // ==========================================
  {
    id: 'mn-rail-ngqura',
    name: 'Manganese Rail Corridor — Hotazel to Ngqura',
    commodity: 'manganese',
    mode: 'rail',
    source: 'Hotazel / Kalahari Manganese Field',
    destination: 'Port Ngqura',
    volume_mtpa: 15.0,
    description: 'Primary manganese export route. 1,003 km via Kimberley and De Aar. Being upgraded to 21 Mtpa. 104-125 wagon trains.',
    railLineName: 'Manganese Corridor — Hotazel to Ngqura',
    color: MN_RAIL,
  },
  {
    id: 'mn-rail-saldanha',
    name: 'Manganese Rail Overflow — OREX to Saldanha',
    commodity: 'manganese',
    mode: 'rail',
    source: 'Hotazel / Kalahari Manganese Field',
    destination: 'Saldanha Bay',
    volume_mtpa: 2.0,
    description: 'Manganese shares the OREX heavy haul line with iron ore. 125-wagon trains on available slots.',
    railLineName: 'OREX Line — Sishen to Saldanha',
    color: MN_RAIL,
  },
  {
    id: 'mn-road-overflow',
    name: 'Manganese Road Overflow Corridor',
    commodity: 'manganese',
    mode: 'road',
    source: 'Hotazel / Kalahari Manganese Field',
    destination: 'Port Ngqura',
    volume_mtpa: 7.0,
    description: 'Rail capacity (~15 Mtpa) cannot handle full demand (~24 Mtpa). ~8 Mtpa diverted to road via N14/N12/N1/N9.',
    roadWaypoints: [
      [22.97, -27.20],   // Hotazel
      [23.07, -28.35],   // Postmasburg
      [24.75, -28.73],   // Kimberley
      [24.02, -30.65],   // De Aar
      [25.62, -32.17],   // Cradock
      [25.67, -33.77],   // Port Ngqura
    ],
    color: MN_ROAD,
  },

  // ==========================================
  // IRON ORE CORRIDORS (~60 Mtpa)
  // ==========================================
  {
    id: 'fe-rail-orex',
    name: 'OREX Iron Ore Rail — Sishen to Saldanha',
    commodity: 'iron_ore',
    mode: 'rail',
    source: 'Sishen / Kolomela (Northern Cape)',
    destination: 'Saldanha Bay',
    volume_mtpa: 58.0,
    description: 'World-class 861 km heavy haul. 375-wagon trains (4 km, 41,400t). 93% of SA iron ore exports. 50kV AC electrification.',
    railLineName: 'OREX Line — Sishen to Saldanha',
    color: FE_RAIL,
  },
  {
    id: 'fe-rail-rb',
    name: 'Iron Ore Rail to Richards Bay',
    commodity: 'iron_ore',
    mode: 'rail',
    source: 'Northern Cape',
    destination: 'Richards Bay',
    volume_mtpa: 4.0,
    description: '7% of SA iron ore exports via Richards Bay. Smaller volumes on COALlink corridor.',
    railLineName: 'Coal Line — Ermelo to Richards Bay',
    color: FE_RAIL,
  },

  // ==========================================
  // COAL CORRIDORS (~52 Mtpa export)
  // ==========================================
  {
    id: 'coal-rail-coallink',
    name: 'COALlink Export Rail — Mpumalanga to Richards Bay',
    commodity: 'coal',
    mode: 'rail',
    source: 'Mpumalanga Coalfields',
    destination: 'Richards Bay (RBCT)',
    volume_mtpa: 48.0,
    description: 'Primary coal export. 580 km double track. 200-wagon trains. Design capacity 91 Mtpa, actual ~52 Mtpa (2024). Dual electrification.',
    railLineName: 'Coal Line — Ermelo to Richards Bay',
    color: COAL_RAIL,
  },
  {
    id: 'coal-rail-waterberg',
    name: 'Waterberg Coal Rail — Lephalale to Richards Bay',
    commodity: 'coal',
    mode: 'rail',
    source: 'Lephalale (Waterberg Coalfield)',
    destination: 'Richards Bay',
    volume_mtpa: 6.0,
    description: '438 km Waterberg line to Ogies junction, then COALlink to Richards Bay. Feeds Medupi/Matimba power stations + export.',
    railLineName: 'Waterberg Line — Lephalale to Ogies',
    color: COAL_RAIL,
  },
  {
    id: 'coal-road-maputo',
    name: 'Coal Road Corridor — Mpumalanga to Maputo',
    commodity: 'coal',
    mode: 'road',
    source: 'Mpumalanga Coalfields',
    destination: 'Maputo',
    volume_mtpa: 3.0,
    description: 'Coal overflow when Richards Bay is congested. Trucks via N4 corridor through Nelspruit to Maputo.',
    roadWaypoints: [
      [29.23, -25.87],   // eMalahleni
      [30.97, -25.48],   // Nelspruit
      [31.95, -25.43],   // Komatipoort
      [32.59, -25.95],   // Maputo
    ],
    color: COAL_ROAD,
  },
];

// Commodity flow summary for display
export const FLOW_SUMMARY: Record<string, { total: number; rail: number; road: number }> = {
  chrome: { total: 17, rail: 5, road: 12 },
  manganese: { total: 24, rail: 17, road: 7 },
  iron_ore: { total: 62, rail: 62, road: 0 },
  coal: { total: 57, rail: 54, road: 3 },
};
