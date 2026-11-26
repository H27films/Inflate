import { CarId, CarProfile, PurchaseLogEntry, TyreContact, TyreCorner, TYRE_CORNERS } from '../types';

export const INITIAL_CONTACTS: TyreContact[] = [
  {
    id: 'contact-1',
    company: 'Car Speed Auto Service',
    website: 'https://goo.gl/maps/sRztvexUCejXzo2o6',
    notes: '34G Jalan Awan Hijau, OUG 58200 KL · Klinicar',
  },
  {
    id: 'contact-2',
    company: 'Wan Hing Motorsports SB',
    website: 'https://goo.gl/maps/4Y6noWsijamvn6b66',
    notes: 'No. 538 Jalan Tuanku Hishamuddin, Kajang',
  },
  {
    id: 'contact-3',
    company: 'Speed Racing Tyres Auto Services',
    phone: '+60 3-8735 0008',
    notes: 'Taman Putra Kajang, 43000 Kajang',
  },
];

export const INITIAL_GARAGE: Record<CarId, CarProfile> = {
  slk250: {
    id: 'slk250',
    displayTitle: 'Mercedes Benz',
    make: 'Mercedes-Benz',
    model: 'SLK350',
    trim: 'WC428D',
    year: 2014,
    bodyStyle: 'roadster',
    paintHex: '#2C3137',
    accentLabel: 'Obsidian Black',
    recommendedKpa: {
      FL: 250,
      FR: 250,
      RL: 270,
      RR: 270,
    },
    defaultSizes: {
      front: '225/40 R18 92Y',
      rear: '245/35 R18 92Y',
    },
    renewals: {
      insurance: '2027-01-10',
      cartax: '2027-01-10',
    },
    pressureLogs: [
      {
        id: 'slk-p-8',
        date: '2026-11-23',
        pressures: { FL: 250, FR: 250, RL: 270, RR: 270 },
        source: 'manual',
        lowTyre: { corner: 'RL' },
      },
      {
        id: 'slk-p-7',
        date: '2026-11-16',
        pressures: { FL: 250, FR: 250, RL: 270, RR: 270 },
        source: 'manual',
      },
      {
        id: 'slk-p-6',
        date: '2026-11-10',
        pressures: { FL: 250, FR: 250, RL: 270, RR: 270 },
        source: 'manual',
      },
      {
        id: 'slk-p-5',
        date: '2026-10-28',
        pressures: { FL: 250, FR: 250, RL: 270, RR: 270 },
        source: 'manual',
      },
      {
        id: 'slk-p-4',
        date: '2026-10-20',
        pressures: { FL: 250, FR: 250, RL: 270, RR: 270 },
        source: 'manual',
      },
      {
        id: 'slk-p-3',
        date: '2026-10-09',
        pressures: { FL: 250, FR: 250, RL: 270, RR: 270 },
        source: 'manual',
      },
      {
        id: 'slk-p-1',
        date: '2026-08-21',
        pressures: { FL: 250, FR: 250, RL: 270, RR: 270 },
        source: 'manual',
        station: 'Car Speed Auto Service, OUG KL',
        note: 'Set after front Prinx Aquila REV fitment & alignment',
      },
      {
        id: 'slk-p-2',
        date: '2025-11-07',
        pressures: { FL: 250, FR: 250, RL: 270, RR: 270 },
        source: 'manual',
        station: 'Wan Hing Motorsports, Kajang',
        note: 'Set after rear Powertrac EcoSport X77 fitment',
      },
    ],
    purchaseLogs: [
      {
        id: 'slk-buy-1',
        date: '2026-08-21',
        vendor: 'Car Speed Auto Service, OUG KL',
        brandModel: 'Prinx Aquila REV',
        tyreSize: '225/40 R18 92Y',
        corners: ['FL', 'FR'],
        totalCost: 567.5,
        notes: 'Klinicar · Tyres RM517.50 + Alignment RM50.00 · Balancing & rubber valves',
      },
      {
        id: 'slk-buy-2',
        date: '2025-11-07',
        vendor: 'Wan Hing Motorsports SB, Kajang',
        brandModel: 'Powertrac EcoSport X77',
        tyreSize: '245/35 R18 92Y',
        corners: ['RL', 'RR'],
        totalCost: 714.0,
        notes: 'RM357 × 2 · Installation, wheel balancing & rubber valves',
      },
    ],
  },
  fortuner: {
    id: 'fortuner',
    displayTitle: 'Toyota Fortuner',
    make: 'Toyota',
    model: 'Fortuner',
    trim: 'WSE 3751',
    year: 2021,
    bodyStyle: 'suv',
    paintHex: '#465047',
    accentLabel: 'Pearl White',
    recommendedKpa: {
      FL: 220,
      FR: 220,
      RL: 220,
      RR: 220,
    },
    defaultSizes: {
      front: '265/65 R17',
      rear: '265/65 R17',
    },
    renewals: {
      insurance: '2027-01-10',
      cartax: '2027-01-10',
    },
    pressureLogs: [
      {
        id: 'fort-p-1',
        date: '2026-01-20',
        pressures: { FL: 220, FR: 220, RL: 220, RR: 220 },
        source: 'manual',
        station: 'Speed Racing Tyres, Kajang',
        note: 'Set after front Fortune A/T fitment & alignment',
      },
    ],
    purchaseLogs: [
      {
        id: 'fort-buy-1',
        date: '2026-01-20',
        vendor: 'Speed Racing Tyres Auto Services, Kajang',
        brandModel: 'Fortune A/T',
        tyreSize: '265/65 R17',
        corners: ['FL', 'FR'],
        totalCost: 1093.2,
        notes: 'Tyres RM900 (2×RM450) · Steel valves RM30 · Alignment & camber nut RM160',
      },
    ],
  },
};

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatRenewalDate(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const day = dt.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  const month = dt.toLocaleDateString('en-US', { month: 'short' });
  const year = dt.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

export function formatCompactMonthDay(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const month = dt.toLocaleDateString('en-US', { month: 'short' });
  const day = dt.getDate();
  return `${month}-${day}`;
}

export function getDaysSince(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dt = parseLocalDate(dateStr);
  dt.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24)));
}

export function formatDaysBetween(newerDateStr: string, olderDateStr: string): string {
  const newer = parseLocalDate(newerDateStr);
  newer.setHours(0, 0, 0, 0);
  const older = parseLocalDate(olderDateStr);
  older.setHours(0, 0, 0, 0);
  const diffDays = Math.abs(
    Math.round((newer.getTime() - older.getTime()) / (1000 * 60 * 60 * 24))
  );
  return diffDays === 1 ? '1 day' : `${diffDays} days`;
}

export function formatRelativeDays(dateStr: string): string {
  const diffDays = getDaysSince(dateStr);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 30) return `${diffDays}d ago`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function formatTyreAge(dateStr: string): string {
  const today = new Date();
  const bought = parseLocalDate(dateStr);
  let months =
    (today.getFullYear() - bought.getFullYear()) * 12 +
    (today.getMonth() - bought.getMonth());
  if (today.getDate() < bought.getDate()) {
    months -= 1;
  }
  if (months <= 0) {
    const diffDays = Math.max(
      0,
      Math.round((today.getTime() - bought.getTime()) / (1000 * 60 * 60 * 24))
    );
    return diffDays === 0 ? 'New' : `${diffDays}d`;
  }
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths}m`;
  if (remMonths === 0) return `${years}y`;
  return `${years}y ${remMonths}m`;
}

export function formatTyreAgeMonths(dateStr: string): string {
  const today = new Date();
  const bought = parseLocalDate(dateStr);
  let months =
    (today.getFullYear() - bought.getFullYear()) * 12 +
    (today.getMonth() - bought.getMonth());
  if (today.getDate() < bought.getDate()) {
    months -= 1;
  }
  if (months <= 0) {
    return '0months';
  }
  return months === 1 ? '1month' : `${months}months`;
}

export function getCornerPurchaseInfo(
  purchaseLogs: PurchaseLogEntry[],
  corner: TyreCorner
): PurchaseLogEntry | null {
  const sorted = [...purchaseLogs].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.find((entry) => entry.corners.includes(corner)) ?? null;
}

export function getOldestActiveTyreInfo(car: CarProfile): {
  oldestDate: string | null;
  newestDate: string | null;
  ageLabel: string;
} {
  const activeDates: string[] = [];
  for (const corner of TYRE_CORNERS) {
    const info = getCornerPurchaseInfo(car.purchaseLogs, corner);
    if (info) activeDates.push(info.date);
  }
  if (activeDates.length === 0) {
    return { oldestDate: null, newestDate: null, ageLabel: 'No record' };
  }
  activeDates.sort();
  const oldestDate = activeDates[0];
  const newestDate = activeDates[activeDates.length - 1];
  return {
    oldestDate,
    newestDate,
    ageLabel: formatTyreAge(oldestDate),
  };
}

export function detectCurrentLocationName(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
          );
          if (res.ok) {
            const data = (await res.json()) as {
              name?: string;
              address?: {
                road?: string;
                suburb?: string;
                city?: string;
                town?: string;
              };
            };
            const parts = [
              data.name,
              data.address?.road,
              data.address?.suburb || data.address?.city || data.address?.town,
            ].filter(Boolean);
            if (parts.length > 0) {
              resolve(parts.slice(0, 2).join(', '));
              return;
            }
          }
        } catch {
          // Fall back to coordinate label
        }
        resolve(`${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied. Enable it in browser settings or type manually.'));
        } else {
          reject(new Error('Unable to get current location. Please try again or type manually.'));
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}
