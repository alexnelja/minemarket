// Map defaults
export const MAP_CONFIG = {
  SA_CENTER: [26, -29] as [number, number],
  SHIPMENT_CENTER: [35, -10] as [number, number],
  SA_ZOOM: 5,
  SHIPMENT_ZOOM: 3,
  FLY_TO_ZOOM: 5,
  FLY_DURATION_MS: 1000,
  EASE_DURATION_MS: 500,
} as const;

// Shipment progress
export const SHIPMENT_CONFIG = {
  TOTAL_MILESTONES: 6,
  MAX_PROGRESS_RATIO: 0.95,
  PULSE_ANIMATION: 'pulse 2s ease-in-out infinite',
  MARKER_BORDER_COLOR: '#0f172a',
} as const;

// Trust scoring
export const TRUST_CONFIG = {
  BAYESIAN_CONFIDENCE_M: 10,
  PLATFORM_DEFAULT_SCORE: 3.0,
  MAX_SCORE: 5,
  DISPUTE_PENALTY_MULTIPLIER: 2,
  MIN_SCORE: 1,
} as const;

// Pagination
export const PAGINATION = {
  COMPLETED_DEALS_LIMIT: 50,
  RECENT_DEALS_DAYS: 30,
} as const;

// Deal status filter groups
export const DEAL_STATUS_FILTERS = {
  COMPLETED: ['completed', 'escrow_released'] as const,
  ACTIVE: ['interest', 'first_accept', 'negotiation', 'second_accept', 'escrow_held', 'loading', 'in_transit', 'delivered'] as const,
  IN_TRANSIT: ['loading', 'in_transit', 'delivered'] as const,
  SETTLED: ['completed', 'escrow_released', 'delivered', 'in_transit', 'loading', 'escrow_held'] as const,
  TERMINAL: ['completed', 'cancelled'] as const,
} as const;

export const QUERY_LIMITS = {
  VESSEL_POSITIONS: 1000,
  VESSEL_POSITIONS_MAX: 2000,
  PORT_CONGESTION: 50,
  INTELLIGENCE_TOP_N: 10,
  TABLE_DISPLAY_ROWS: 10,
} as const;
