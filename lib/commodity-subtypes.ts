import type { CommodityType, PricingUnit } from './types';

export interface CommoditySubtype {
  key: string;
  commodity: CommodityType;
  label: string;
  gradeRange: string;
  primaryUse: string;
  priceIndex: string;
  priceIndexType: 'published' | 'platform_avg' | 'estimated';
  pricingUnit: PricingUnit;
  specFields: { key: string; label: string; unit?: string }[];
}

// ─── Chrome ──────────────────────────────────────────────────────────────────

const CHROME_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'chrome_met_lumpy',
    commodity: 'chrome',
    label: 'Metallurgical Grade (Lumpy)',
    gradeRange: '42-46% Cr\u2082O\u2083',
    primaryUse: 'Ferrochrome production',
    priceIndex: 'Fastmarkets Chrome 42% CIF China',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cr2o3_pct', label: 'Cr\u2082O\u2083', unit: '%' },
      { key: 'cr_fe_ratio', label: 'Cr:Fe Ratio' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'mgo_pct', label: 'MgO', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
      { key: 'size_mm', label: 'Size', unit: 'mm' },
    ],
  },
  {
    key: 'chrome_met_conc',
    commodity: 'chrome',
    label: 'Metallurgical Grade (Concentrate)',
    gradeRange: '44-48% Cr\u2082O\u2083',
    primaryUse: 'Ferrochrome production',
    priceIndex: 'Fastmarkets Chrome Conc 44% CIF',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cr2o3_pct', label: 'Cr\u2082O\u2083', unit: '%' },
      { key: 'cr_fe_ratio', label: 'Cr:Fe Ratio' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'chrome_chemical_lg6',
    commodity: 'chrome',
    label: 'Chemical Grade (LG6)',
    gradeRange: '46-48% Cr\u2082O\u2083',
    primaryUse: 'Chromium chemicals, pigments',
    priceIndex: 'Fastmarkets Chemical Grade',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cr2o3_pct', label: 'Cr\u2082O\u2083', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'chrome_foundry',
    commodity: 'chrome',
    label: 'Foundry Grade',
    gradeRange: '46-48% Cr\u2082O\u2083, low SiO\u2082',
    primaryUse: 'Foundry sand',
    priceIndex: 'Fastmarkets Foundry Sand',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cr2o3_pct', label: 'Cr\u2082O\u2083', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
      { key: 'size_mm', label: 'Size', unit: 'mm' },
    ],
  },
  {
    key: 'chrome_ug2',
    commodity: 'chrome',
    label: 'UG2 Concentrate',
    gradeRange: '40-42% Cr\u2082O\u2083',
    primaryUse: 'By-product of PGM mining',
    priceIndex: 'Discounted vs LG6',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cr2o3_pct', label: 'Cr\u2082O\u2083', unit: '%' },
      { key: 'cr_fe_ratio', label: 'Cr:Fe Ratio' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'chrome_ferrochrome_hc',
    commodity: 'chrome',
    label: 'Ferrochrome (HC)',
    gradeRange: '60-70% Cr',
    primaryUse: 'Stainless steel',
    priceIndex: 'Metal Bulletin HC FeCr',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cr_pct', label: 'Cr', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
      { key: 'si_pct', label: 'Si', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
    ],
  },
  {
    key: 'chrome_ferrochrome_charge',
    commodity: 'chrome',
    label: 'Ferrochrome (Charge)',
    gradeRange: '50-55% Cr',
    primaryUse: 'Stainless steel',
    priceIndex: 'Metal Bulletin Charge Chrome',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cr_pct', label: 'Cr', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
      { key: 'si_pct', label: 'Si', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
    ],
  },
];

// ─── Manganese ───────────────────────────────────────────────────────────────

const MANGANESE_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'mn_high_grade',
    commodity: 'manganese',
    label: 'High-Grade Ore',
    gradeRange: '44-50% Mn',
    primaryUse: 'Direct smelting',
    priceIndex: 'CRU/Metal Bulletin Mn Ore 44% CIF',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_dmtu',
    specFields: [
      { key: 'mn_pct', label: 'Mn', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'p_pct', label: 'P', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'mn_medium_grade',
    commodity: 'manganese',
    label: 'Medium-Grade Ore',
    gradeRange: '38-44% Mn',
    primaryUse: 'Smelting with blend',
    priceIndex: 'CRU/Metal Bulletin Mn Ore 37% CIF',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_dmtu',
    specFields: [
      { key: 'mn_pct', label: 'Mn', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'p_pct', label: 'P', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'mn_low_grade',
    commodity: 'manganese',
    label: 'Low-Grade Ore',
    gradeRange: '30-38% Mn',
    primaryUse: 'Beneficiation',
    priceIndex: 'Discounted vs 44% index',
    priceIndexType: 'estimated',
    pricingUnit: 'per_dmtu',
    specFields: [
      { key: 'mn_pct', label: 'Mn', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'mn_supergrade',
    commodity: 'manganese',
    label: 'Supergrade Ore (Hotazel)',
    gradeRange: '60-70% Mn',
    primaryUse: 'Premium smelting',
    priceIndex: 'Premium to 44% index',
    priceIndexType: 'estimated',
    pricingUnit: 'per_dmtu',
    specFields: [
      { key: 'mn_pct', label: 'Mn', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'p_pct', label: 'P', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'mn_hc_femn',
    commodity: 'manganese',
    label: 'High-Carbon Ferromanganese',
    gradeRange: '74-82% Mn, 7-7.5% C',
    primaryUse: 'Steelmaking',
    priceIndex: 'Metal Bulletin HC FeMn',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'mn_pct', label: 'Mn', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'si_pct', label: 'Si', unit: '%' },
      { key: 'p_pct', label: 'P', unit: '%' },
    ],
  },
  {
    key: 'mn_mc_femn',
    commodity: 'manganese',
    label: 'Medium-Carbon Ferromanganese',
    gradeRange: '80-90% Mn, <1.5% C',
    primaryUse: 'Steelmaking',
    priceIndex: 'Metal Bulletin MC FeMn',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'mn_pct', label: 'Mn', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'si_pct', label: 'Si', unit: '%' },
    ],
  },
  {
    key: 'mn_simn',
    commodity: 'manganese',
    label: 'Silicomanganese',
    gradeRange: '65-68% Mn, 12-18% Si',
    primaryUse: 'Steelmaking',
    priceIndex: 'Metal Bulletin SiMn',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'mn_pct', label: 'Mn', unit: '%' },
      { key: 'si_pct', label: 'Si', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
    ],
  },
];

// ─── Iron Ore ────────────────────────────────────────────────────────────────

const IRON_ORE_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'iron_fines_standard',
    commodity: 'iron_ore',
    label: 'Fines (Standard)',
    gradeRange: '58-62% Fe',
    primaryUse: 'Sinter feed',
    priceIndex: 'Platts IODEX 62% CFR China',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'p_pct', label: 'P', unit: '%' },
      { key: 's_pct', label: 'S', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
      { key: 'loi_pct', label: 'LOI', unit: '%' },
    ],
  },
  {
    key: 'iron_fines_high',
    commodity: 'iron_ore',
    label: 'Fines (High Grade)',
    gradeRange: '63.5-65% Fe',
    primaryUse: 'Premium sinter',
    priceIndex: 'Platts 65% Fe CFR China',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'p_pct', label: 'P', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'iron_lump',
    commodity: 'iron_ore',
    label: 'Lump Ore',
    gradeRange: '62-65% Fe',
    primaryUse: 'Direct charge BF',
    priceIndex: 'Platts Lump Premium',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
      { key: 'tumble_index', label: 'Tumble Index', unit: '%' },
      { key: 'size_mm', label: 'Size', unit: 'mm' },
    ],
  },
  {
    key: 'iron_pellet',
    commodity: 'iron_ore',
    label: 'Pellet',
    gradeRange: '65-67% Fe',
    primaryUse: 'Direct charge BF/DRI',
    priceIndex: 'Platts Pellet Premium',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'iron_concentrate',
    commodity: 'iron_ore',
    label: 'Concentrate',
    gradeRange: '65-68% Fe',
    primaryUse: 'Pellet feed',
    priceIndex: 'Platts 65% Fe Conc',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'p_pct', label: 'P', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'iron_low_grade',
    commodity: 'iron_ore',
    label: 'Low-Grade Fines',
    gradeRange: '55-58% Fe',
    primaryUse: 'Blending',
    priceIndex: 'Platts 58% Fe CFR',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
];

// ─── Coal ────────────────────────────────────────────────────────────────────

const COAL_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'coal_rb1',
    commodity: 'coal',
    label: 'RB1 (Export Thermal)',
    gradeRange: '6,000 kcal/kg NAR',
    primaryUse: 'Power generation',
    priceIndex: 'API4 FOB Richards Bay',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cv_kcal', label: 'CV (NAR)', unit: 'kcal/kg' },
      { key: 'ash_pct', label: 'Ash', unit: '%' },
      { key: 'volatile_pct', label: 'Volatile Matter', unit: '%' },
      { key: 's_pct', label: 'Sulphur', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
      { key: 'hgi', label: 'HGI' },
    ],
  },
  {
    key: 'coal_rb2',
    commodity: 'coal',
    label: 'RB2 (Export Thermal)',
    gradeRange: '5,700 kcal/kg NAR',
    primaryUse: 'Power generation',
    priceIndex: 'API4 Discounted',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cv_kcal', label: 'CV (NAR)', unit: 'kcal/kg' },
      { key: 'ash_pct', label: 'Ash', unit: '%' },
      { key: 'volatile_pct', label: 'Volatile Matter', unit: '%' },
      { key: 's_pct', label: 'Sulphur', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'coal_rb3',
    commodity: 'coal',
    label: 'RB3 (Export Thermal)',
    gradeRange: '5,500 kcal/kg NAR',
    primaryUse: 'Power generation',
    priceIndex: 'API4 Discounted',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cv_kcal', label: 'CV (NAR)', unit: 'kcal/kg' },
      { key: 'ash_pct', label: 'Ash', unit: '%' },
      { key: 'volatile_pct', label: 'Volatile Matter', unit: '%' },
      { key: 's_pct', label: 'Sulphur', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'coal_eskom',
    commodity: 'coal',
    label: 'Eskom Grade (Domestic)',
    gradeRange: '4,800 kcal/kg NAR',
    primaryUse: 'SA domestic power',
    priceIndex: 'Eskom Contract',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cv_kcal', label: 'CV (NAR)', unit: 'kcal/kg' },
      { key: 'ash_pct', label: 'Ash', unit: '%' },
      { key: 'volatile_pct', label: 'Volatile Matter', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'coal_hcc',
    commodity: 'coal',
    label: 'Hard Coking Coal',
    gradeRange: 'High CSR',
    primaryUse: 'Steelmaking coke',
    priceIndex: 'PLV HCC FOB Australia',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cv_kcal', label: 'CV (GAR)', unit: 'kcal/kg' },
      { key: 'ash_pct', label: 'Ash', unit: '%' },
      { key: 'volatile_pct', label: 'Volatile Matter', unit: '%' },
      { key: 's_pct', label: 'Sulphur', unit: '%' },
      { key: 'csr', label: 'CSR' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'coal_pci',
    commodity: 'coal',
    label: 'PCI Coal',
    gradeRange: 'Low vol, high CV',
    primaryUse: 'Pulverized coal injection',
    priceIndex: 'PCI FOB Australia',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cv_kcal', label: 'CV (GAR)', unit: 'kcal/kg' },
      { key: 'ash_pct', label: 'Ash', unit: '%' },
      { key: 'volatile_pct', label: 'Volatile Matter', unit: '%' },
      { key: 's_pct', label: 'Sulphur', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'coal_sscc',
    commodity: 'coal',
    label: 'Semi-Soft Coking Coal',
    gradeRange: 'Medium CSR',
    primaryUse: 'Coke blending',
    priceIndex: 'SSCC Index',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cv_kcal', label: 'CV (GAR)', unit: 'kcal/kg' },
      { key: 'ash_pct', label: 'Ash', unit: '%' },
      { key: 'volatile_pct', label: 'Volatile Matter', unit: '%' },
      { key: 'csr', label: 'CSR' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
];

// ─── Platinum (PGMs) ─────────────────────────────────────────────────────────

const PLATINUM_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'pgm_concentrate',
    commodity: 'platinum',
    label: 'PGM Concentrate',
    gradeRange: '100-1,000 g/t PGM',
    primaryUse: 'Smelter feed',
    priceIndex: 'Negotiated on contained metal',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'pt_gpt', label: 'Pt', unit: 'g/t' },
      { key: 'pd_gpt', label: 'Pd', unit: 'g/t' },
      { key: 'rh_gpt', label: 'Rh', unit: 'g/t' },
      { key: 'au_gpt', label: 'Au', unit: 'g/t' },
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'cu_pct', label: 'Cu', unit: '%' },
      { key: 's_pct', label: 'S', unit: '%' },
    ],
  },
  {
    key: 'pgm_matte',
    commodity: 'platinum',
    label: 'PGM Matte',
    gradeRange: '2,000 g/t PGM',
    primaryUse: 'Refinery feed',
    priceIndex: 'Negotiated',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'pgm_total_gpt', label: 'Total PGM', unit: 'g/t' },
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'cu_pct', label: 'Cu', unit: '%' },
      { key: 's_pct', label: 'S', unit: '%' },
    ],
  },
  {
    key: 'pt_sponge',
    commodity: 'platinum',
    label: 'Platinum Sponge',
    gradeRange: '99.95% Pt',
    primaryUse: 'Industrial catalyst',
    priceIndex: 'LPPM Platinum Fix ($/oz)',
    priceIndexType: 'published',
    pricingUnit: 'per_troy_oz',
    specFields: [
      { key: 'purity_pct', label: 'Purity', unit: '%' },
    ],
  },
  {
    key: 'pt_ingot',
    commodity: 'platinum',
    label: 'Platinum Ingot/Bar',
    gradeRange: '99.95% Pt',
    primaryUse: 'Investment/industrial',
    priceIndex: 'LPPM Platinum Fix',
    priceIndexType: 'published',
    pricingUnit: 'per_troy_oz',
    specFields: [
      { key: 'purity_pct', label: 'Purity', unit: '%' },
      { key: 'weight_troy_oz', label: 'Weight', unit: 'oz' },
    ],
  },
  {
    key: 'pd_sponge',
    commodity: 'platinum',
    label: 'Palladium Sponge',
    gradeRange: '99.95% Pd',
    primaryUse: 'Catalyst',
    priceIndex: 'LPPM Palladium Fix',
    priceIndexType: 'published',
    pricingUnit: 'per_troy_oz',
    specFields: [
      { key: 'purity_pct', label: 'Purity', unit: '%' },
    ],
  },
  {
    key: 'rh_metal',
    commodity: 'platinum',
    label: 'Rhodium',
    gradeRange: '99.9% Rh',
    primaryUse: 'Catalyst',
    priceIndex: 'Johnson Matthey Base Price',
    priceIndexType: 'published',
    pricingUnit: 'per_troy_oz',
    specFields: [
      { key: 'purity_pct', label: 'Purity', unit: '%' },
    ],
  },
];

// ─── Gold ────────────────────────────────────────────────────────────────────

const GOLD_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'gold_dore',
    commodity: 'gold',
    label: 'Dor\u00e9 Bar',
    gradeRange: '70-95% Au',
    primaryUse: 'Refinery feed',
    priceIndex: 'LBMA Fix minus TC/RC',
    priceIndexType: 'published',
    pricingUnit: 'per_troy_oz',
    specFields: [
      { key: 'au_pct', label: 'Au', unit: '%' },
      { key: 'ag_ppm', label: 'Ag', unit: 'ppm' },
      { key: 'weight_troy_oz', label: 'Weight', unit: 'oz' },
    ],
  },
  {
    key: 'gold_good_delivery',
    commodity: 'gold',
    label: 'Good Delivery Bar (400 oz)',
    gradeRange: '99.5%+ Au',
    primaryUse: 'Wholesale market',
    priceIndex: 'LBMA Gold Price AM/PM ($/oz)',
    priceIndexType: 'published',
    pricingUnit: 'per_troy_oz',
    specFields: [
      { key: 'fineness', label: 'Fineness' },
      { key: 'weight_troy_oz', label: 'Weight', unit: 'oz' },
    ],
  },
  {
    key: 'gold_kilobar',
    commodity: 'gold',
    label: 'Kilobar',
    gradeRange: '99.99% Au',
    primaryUse: 'Retail/institutional',
    priceIndex: 'LBMA + Premium',
    priceIndexType: 'published',
    pricingUnit: 'per_troy_oz',
    specFields: [
      { key: 'fineness', label: 'Fineness' },
      { key: 'weight_troy_oz', label: 'Weight', unit: 'oz' },
    ],
  },
  {
    key: 'gold_coins',
    commodity: 'gold',
    label: 'Coins/Small Bars',
    gradeRange: '99.9-99.99% Au',
    primaryUse: 'Retail investment',
    priceIndex: 'LBMA + Premium',
    priceIndexType: 'published',
    pricingUnit: 'per_troy_oz',
    specFields: [
      { key: 'fineness', label: 'Fineness' },
      { key: 'weight_troy_oz', label: 'Weight', unit: 'oz' },
    ],
  },
];

// ─── Copper ──────────────────────────────────────────────────────────────────

const COPPER_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'cu_concentrate',
    commodity: 'copper',
    label: 'Concentrate',
    gradeRange: '24-36% Cu',
    primaryUse: 'Smelter feed',
    priceIndex: 'LME Copper minus TC/RC',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cu_pct', label: 'Cu', unit: '%' },
      { key: 'as_ppm', label: 'As', unit: 'ppm' },
      { key: 'bi_ppm', label: 'Bi', unit: 'ppm' },
      { key: 'fe_ppm', label: 'Fe', unit: 'ppm' },
      { key: 'pb_ppm', label: 'Pb', unit: 'ppm' },
      { key: 's_ppm', label: 'S', unit: 'ppm' },
    ],
  },
  {
    key: 'cu_blister',
    commodity: 'copper',
    label: 'Blister Copper',
    gradeRange: '~99% Cu',
    primaryUse: 'Refinery feed',
    priceIndex: 'LME minus refining charge',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cu_pct', label: 'Cu', unit: '%' },
      { key: 'se_ppm', label: 'Se', unit: 'ppm' },
      { key: 'te_ppm', label: 'Te', unit: 'ppm' },
    ],
  },
  {
    key: 'cu_cathode',
    commodity: 'copper',
    label: 'Cathode Grade A',
    gradeRange: '99.9935%+ Cu',
    primaryUse: 'End use/trading',
    priceIndex: 'LME Copper ($/t)',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cu_pct', label: 'Cu', unit: '%' },
    ],
  },
  {
    key: 'cu_scrap_1',
    commodity: 'copper',
    label: 'Copper Scrap (#1)',
    gradeRange: '99%+ Cu',
    primaryUse: 'Secondary smelting',
    priceIndex: 'LME minus discount',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cu_pct', label: 'Cu', unit: '%' },
    ],
  },
  {
    key: 'cu_scrap_2',
    commodity: 'copper',
    label: 'Copper Scrap (#2)',
    gradeRange: '94-96% Cu',
    primaryUse: 'Secondary refining',
    priceIndex: 'LME minus larger discount',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'cu_pct', label: 'Cu', unit: '%' },
    ],
  },
];

// ─── Vanadium ────────────────────────────────────────────────────────────────

const VANADIUM_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'v_v2o5_flake',
    commodity: 'vanadium',
    label: 'V\u2082O\u2085 Flake (98%)',
    gradeRange: '98% V\u2082O\u2085',
    primaryUse: 'Steel, chemicals',
    priceIndex: 'Metal Bulletin V\u2082O\u2085 ($/lb)',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_lb',
    specFields: [
      { key: 'v2o5_pct', label: 'V\u2082O\u2085', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'si_pct', label: 'Si', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'v_v2o5_powder',
    commodity: 'vanadium',
    label: 'V\u2082O\u2085 Powder (99.5%)',
    gradeRange: '99.5% V\u2082O\u2085',
    primaryUse: 'Batteries, catalysts',
    priceIndex: 'Premium to Flake',
    priceIndexType: 'estimated',
    pricingUnit: 'per_lb',
    specFields: [
      { key: 'v2o5_pct', label: 'V\u2082O\u2085', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'v_fev80',
    commodity: 'vanadium',
    label: 'Ferrovanadium (FeV80)',
    gradeRange: '75-85% V',
    primaryUse: 'Steelmaking additive',
    priceIndex: 'Metal Bulletin FeV ($/kgV)',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_lb',
    specFields: [
      { key: 'v_pct', label: 'V', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'si_pct', label: 'Si', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
    ],
  },
  {
    key: 'v_nitrovan',
    commodity: 'vanadium',
    label: 'Nitrovan',
    gradeRange: '78-82% V, >6% N',
    primaryUse: 'HSLA steel',
    priceIndex: 'Metal Bulletin Nitrovan',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_lb',
    specFields: [
      { key: 'v_pct', label: 'V', unit: '%' },
      { key: 'n_pct', label: 'N', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
    ],
  },
  {
    key: 'v_electrolyte',
    commodity: 'vanadium',
    label: 'V\u2082O\u2085 Electrolyte',
    gradeRange: '1.6M solution',
    primaryUse: 'VRFB batteries',
    priceIndex: 'Negotiated',
    priceIndexType: 'estimated',
    pricingUnit: 'per_lb',
    specFields: [
      { key: 'v2o5_pct', label: 'V\u2082O\u2085', unit: '%' },
    ],
  },
];

// ─── Titanium (Mineral Sands) ────────────────────────────────────────────────

const TITANIUM_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'ti_ilmenite_sulphate',
    commodity: 'titanium',
    label: 'Ilmenite (Sulphate Grade)',
    gradeRange: '45-55% TiO\u2082',
    primaryUse: 'TiO\u2082 pigment (sulphate route)',
    priceIndex: 'Fastmarkets Ilmenite ($/t)',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'tio2_pct', label: 'TiO\u2082', unit: '%' },
      { key: 'fe2o3_pct', label: 'Fe\u2082O\u2083', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'al2o3_pct', label: 'Al\u2082O\u2083', unit: '%' },
      { key: 'cr2o3_pct', label: 'Cr\u2082O\u2083', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'ti_ilmenite_chloride',
    commodity: 'titanium',
    label: 'Ilmenite (Chloride Grade)',
    gradeRange: '58-62% TiO\u2082',
    primaryUse: 'TiO\u2082 pigment (chloride route)',
    priceIndex: 'Fastmarkets Chloride Ilmenite',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'tio2_pct', label: 'TiO\u2082', unit: '%' },
      { key: 'fe2o3_pct', label: 'Fe\u2082O\u2083', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'cr2o3_pct', label: 'Cr\u2082O\u2083', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'ti_slag',
    commodity: 'titanium',
    label: 'Titanium Slag',
    gradeRange: '75-86% TiO\u2082',
    primaryUse: 'TiO\u2082 pigment feedstock',
    priceIndex: 'Fastmarkets Ti Slag',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'tio2_pct', label: 'TiO\u2082', unit: '%' },
      { key: 'fe2o3_pct', label: 'Fe\u2082O\u2083', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'v2o5_pct', label: 'V\u2082O\u2085', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'ti_synth_rutile',
    commodity: 'titanium',
    label: 'Synthetic Rutile',
    gradeRange: '88-95% TiO\u2082',
    primaryUse: 'TiO\u2082 pigment (premium)',
    priceIndex: 'Fastmarkets Synth Rutile',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'tio2_pct', label: 'TiO\u2082', unit: '%' },
      { key: 'fe2o3_pct', label: 'Fe\u2082O\u2083', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'ti_natural_rutile',
    commodity: 'titanium',
    label: 'Natural Rutile',
    gradeRange: '92-96% TiO\u2082',
    primaryUse: 'TiO\u2082 pigment/welding',
    priceIndex: 'Fastmarkets Natural Rutile',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'tio2_pct', label: 'TiO\u2082', unit: '%' },
      { key: 'fe2o3_pct', label: 'Fe\u2082O\u2083', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'ti_zircon',
    commodity: 'titanium',
    label: 'Zircon (Co-product)',
    gradeRange: '65-66% ZrO\u2082',
    primaryUse: 'Ceramics, refractories',
    priceIndex: 'Fastmarkets Zircon ($/t)',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'zro2_pct', label: 'ZrO\u2082', unit: '%' },
      { key: 'tio2_pct', label: 'TiO\u2082', unit: '%' },
      { key: 'fe2o3_pct', label: 'Fe\u2082O\u2083', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
    ],
  },
];

// ─── Nickel ──────────────────────────────────────────────────────────────────

// Nickel subtypes are defined for reference but are not currently in the
// CommodityType enum. They are excluded from the active COMMODITY_SUBTYPES array.
// If/when 'nickel' is added as a CommodityType, uncomment the nickel section
// in the master registry below.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const NICKEL_SUBTYPES_REFERENCE = [
  {
    key: 'ni_laterite',
    label: 'Laterite Ore',
    gradeRange: '1-2% Ni',
    primaryUse: 'HPAL/smelting',
    priceIndex: 'Negotiated on payable Ni',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'co_pct', label: 'Co', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'sio2_pct', label: 'SiO\u2082', unit: '%' },
      { key: 'moisture_pct', label: 'Moisture', unit: '%' },
    ],
  },
  {
    key: 'ni_sulphide_conc',
    commodity: 'copper',
    label: 'Sulphide Concentrate',
    gradeRange: '8-20% Ni',
    primaryUse: 'Smelting',
    priceIndex: 'LME Nickel minus TC/RC',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'cu_pct', label: 'Cu', unit: '%' },
      { key: 'co_pct', label: 'Co', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 's_pct', label: 'S', unit: '%' },
    ],
  },
  {
    key: 'ni_matte',
    commodity: 'copper',
    label: 'Nickel Matte',
    gradeRange: '40-75% Ni',
    primaryUse: 'Refining',
    priceIndex: 'LME Nickel minus RC',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'cu_pct', label: 'Cu', unit: '%' },
      { key: 'co_pct', label: 'Co', unit: '%' },
      { key: 's_pct', label: 'S', unit: '%' },
    ],
  },
  {
    key: 'ni_cathode',
    commodity: 'copper',
    label: 'Nickel Cathode',
    gradeRange: '99.8%+ Ni',
    primaryUse: 'LME deliverable',
    priceIndex: 'LME Nickel ($/t)',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'co_pct', label: 'Co', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
    ],
  },
  {
    key: 'ni_briquette',
    commodity: 'copper',
    label: 'Nickel Briquette',
    gradeRange: '99.8%+ Ni',
    primaryUse: 'LME deliverable',
    priceIndex: 'LME Nickel',
    priceIndexType: 'published',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'co_pct', label: 'Co', unit: '%' },
    ],
  },
  {
    key: 'ni_ferronickel',
    commodity: 'copper',
    label: 'Ferronickel',
    gradeRange: '20-40% Ni',
    primaryUse: 'Stainless steel',
    priceIndex: 'LME Nickel minus discount',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
      { key: 'si_pct', label: 'Si', unit: '%' },
    ],
  },
  {
    key: 'ni_npi',
    commodity: 'copper',
    label: 'NPI (Nickel Pig Iron)',
    gradeRange: '8-15% Ni',
    primaryUse: 'Stainless steel',
    priceIndex: 'Chinese NPI Index',
    priceIndexType: 'platform_avg',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'ni_pct', label: 'Ni', unit: '%' },
      { key: 'fe_pct', label: 'Fe', unit: '%' },
      { key: 'c_pct', label: 'C', unit: '%' },
      { key: 'p_pct', label: 'P', unit: '%' },
    ],
  },
];

// Note: the CommodityType enum doesn't include 'nickel' — it uses 'copper' for base metals.
// We keep nickel subtypes here but they won't be surfaced unless the schema adds a nickel type.
// For now, we exclude them from the main commodity map.

// ─── Aggregates (no subtypes in spec, provide a generic entry) ───────────────

const AGGREGATES_SUBTYPES: CommoditySubtype[] = [
  {
    key: 'agg_crushed_stone',
    commodity: 'aggregates',
    label: 'Crushed Stone',
    gradeRange: 'Various sizes',
    primaryUse: 'Construction, road base',
    priceIndex: 'Local spot',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'particle_size_mm', label: 'Particle Size (mm)' },
      { key: 'crushing_value', label: 'Crushing Value' },
      { key: 'density', label: 'Density (t/m\u00b3)' },
    ],
  },
  {
    key: 'agg_sand',
    commodity: 'aggregates',
    label: 'Building Sand',
    gradeRange: 'Fine/coarse',
    primaryUse: 'Concrete, plaster',
    priceIndex: 'Local spot',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'particle_size_mm', label: 'Particle Size (mm)' },
      { key: 'silt_content_pct', label: 'Silt Content (%)' },
      { key: 'moisture_pct', label: 'Moisture (%)' },
    ],
  },
  {
    key: 'agg_gravel',
    commodity: 'aggregates',
    label: 'Gravel',
    gradeRange: '6-40mm',
    primaryUse: 'Drainage, fill',
    priceIndex: 'Local spot',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'particle_size_mm', label: 'Particle Size (mm)' },
      { key: 'density', label: 'Density (t/m\u00b3)' },
      { key: 'moisture_pct', label: 'Moisture (%)' },
    ],
  },
  {
    key: 'agg_limestone',
    commodity: 'aggregates',
    label: 'Limestone',
    gradeRange: 'CaCO\u2083 90%+',
    primaryUse: 'Cement, flux',
    priceIndex: 'Local spot',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'calcium_carbonate_pct', label: 'CaCO\u2083 (%)' },
      { key: 'sio2_pct', label: 'SiO\u2082 (%)' },
      { key: 'particle_size_mm', label: 'Size (mm)' },
    ],
  },
  {
    key: 'agg_dolomite',
    commodity: 'aggregates',
    label: 'Dolomite',
    gradeRange: 'MgCO\u2083/CaCO\u2083',
    primaryUse: 'Steel flux, construction',
    priceIndex: 'Local spot',
    priceIndexType: 'estimated',
    pricingUnit: 'per_tonne',
    specFields: [
      { key: 'mgo_pct', label: 'MgO (%)' },
      { key: 'cao_pct', label: 'CaO (%)' },
      { key: 'sio2_pct', label: 'SiO\u2082 (%)' },
    ],
  },
];

// ─── Master registry ─────────────────────────────────────────────────────────

export const COMMODITY_SUBTYPES: CommoditySubtype[] = [
  ...CHROME_SUBTYPES,
  ...MANGANESE_SUBTYPES,
  ...IRON_ORE_SUBTYPES,
  ...COAL_SUBTYPES,
  ...PLATINUM_SUBTYPES,
  ...GOLD_SUBTYPES,
  ...COPPER_SUBTYPES,
  ...VANADIUM_SUBTYPES,
  ...TITANIUM_SUBTYPES,
  // Nickel subtypes excluded — 'nickel' is not yet in CommodityType.
  // See NICKEL_SUBTYPES_REFERENCE above.
  ...AGGREGATES_SUBTYPES,
];

/** Get all subtypes for a given commodity */
export function getSubtypesForCommodity(commodity: CommodityType): CommoditySubtype[] {
  return COMMODITY_SUBTYPES.filter((s) => s.commodity === commodity);
}

/** Look up a single subtype by key */
export function getSubtypeByKey(key: string): CommoditySubtype | undefined {
  return COMMODITY_SUBTYPES.find((s) => s.key === key);
}

/** Map of subtype key -> label, useful for display */
export const SUBTYPE_LABELS: Record<string, string> = Object.fromEntries(
  COMMODITY_SUBTYPES.map((s) => [s.key, s.label]),
);
