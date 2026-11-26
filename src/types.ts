export type CarId = 'slk250' | 'fortuner';

export type TyreCorner = 'FL' | 'FR' | 'RL' | 'RR';

export const TYRE_CORNERS: TyreCorner[] = ['FL', 'FR', 'RL', 'RR'];

export const CORNER_LABELS: Record<TyreCorner, string> = {
  FL: 'Front Left',
  FR: 'Front Right',
  RL: 'Rear Left',
  RR: 'Rear Right',
};

export interface CornerPressures {
  FL: number;
  FR: number;
  RL: number;
  RR: number;
}

export interface PressureLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  pressures: CornerPressures;
  beforePressures?: Partial<CornerPressures>;
  source: 'camera' | 'manual';
  station?: string;
  note?: string;
  lowTyre?: {
    corner: TyreCorner;
    beforeKpa?: number;
  };
  photoDataUrl?: string;
  detectedPsi?: number | null;
}

export interface PurchaseLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  vendor: string;
  brandModel: string;
  tyreSize: string;
  corners: TyreCorner[];
  totalCost: number;
  notes?: string;
}

export interface CarRenewals {
  insurance: string; // YYYY-MM-DD
  cartax: string; // YYYY-MM-DD
  coolant?: string; // YYYY-MM-DD (SLK only)
}

export interface CarProfile {
  id: CarId;
  displayTitle: string;
  make: string;
  model: string;
  trim: string;
  year: number;
  bodyStyle: 'roadster' | 'suv';
  paintHex: string;
  accentLabel: string;
  recommendedKpa: CornerPressures;
  previousReadings?: Partial<CornerPressures>;
  defaultSizes: {
    front: string;
    rear: string;
  };
  renewals?: CarRenewals;
  pressureLogs: PressureLogEntry[];
  purchaseLogs: PurchaseLogEntry[];
}

export interface PhotoAnalysisResult {
  isTyrePressureContext: boolean;
  detectedPsi: number | null;
  unitDetected: string;
  cornerHint: TyreCorner | 'ALL';
  confidence: 'high' | 'medium' | 'low';
  summary: string;
}

export interface TyreContact {
  id: string;
  company: string;
  website?: string;
  phone?: string;
  notes?: string;
}
