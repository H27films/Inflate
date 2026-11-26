import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Plus } from 'lucide-react';
import {
  CarId,
  CarProfile,
  CORNER_LABELS,
  PressureLogEntry,
  PurchaseLogEntry,
  TYRE_CORNERS,
  TyreContact,
  TyreCorner,
} from './types';
import {
  formatDisplayDate,
  formatTyreAge,
  getCornerPurchaseInfo,
  getDaysSince,
  INITIAL_CONTACTS,
  INITIAL_GARAGE,
} from './data/initialGarage';
import { CarBirdsEyeView } from './components/CarBirdsEyeView';
import { PressureLogSheet } from './components/PressureLogSheet';
import { PurchasesView } from './components/PurchasesView';
import { QuickLogModal } from './components/QuickLogModal';
import { ActiveTab, BottomNav } from './components/BottomNav';

const STORAGE_KEY = 'inflate_garage_v5';
const CONTACTS_STORAGE_KEY = 'inflate_contacts_v2';

function loadStoredContacts(): TyreContact[] {
  try {
    const raw = window.localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (!raw) return INITIAL_CONTACTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_CONTACTS;
  } catch {
    return INITIAL_CONTACTS;
  }
}

function loadStoredGarage(): Record<CarId, CarProfile> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_GARAGE;
    const parsed = JSON.parse(raw) as Partial<Record<CarId, CarProfile>>;
    return {
      slk250: parsed.slk250 ?? INITIAL_GARAGE.slk250,
      fortuner: parsed.fortuner ?? INITIAL_GARAGE.fortuner,
    };
  } catch {
    return INITIAL_GARAGE;
  }
}

export default function App() {
  const [garage, setGarage] = useState<Record<CarId, CarProfile>>(loadStoredGarage);
  const [contacts, setContacts] = useState<TyreContact[]>(loadStoredContacts);
  const [activeCarId, setActiveCarId] = useState<CarId>('slk250');
  const [activeTab, setActiveTab] = useState<ActiveTab>('garage');
  const [selectedCorner, setSelectedCorner] = useState<TyreCorner | null>(null);
  const [logExpanded, setLogExpanded] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [addPurchaseOpen, setAddPurchaseOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(garage));
    } catch {
      // Ignore storage quota issues
    }
  }, [garage]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
    } catch {
      // Ignore storage quota issues
    }
  }, [contacts]);

  const activeCar = garage[activeCarId];
  const otherCarId: CarId = activeCarId === 'slk250' ? 'fortuner' : 'slk250';
  const otherCar = garage[otherCarId];

  const handleSwapCar = () => {
    setActiveCarId(otherCarId);
    setSelectedCorner(null);
  };

  const sortedPressureLogs = useMemo(
    () => [...activeCar.pressureLogs].sort((a, b) => b.date.localeCompare(a.date)),
    [activeCar.pressureLogs]
  );

  const carWithSortedLogs = useMemo<CarProfile>(
    () => ({ ...activeCar, pressureLogs: sortedPressureLogs }),
    [activeCar, sortedPressureLogs]
  );

  const latestPressure = sortedPressureLogs[0] ?? null;
  const daysSinceLastTopUp = latestPressure ? getDaysSince(latestPressure.date) : null;

  const handleAddPressureLog = (entry: Omit<PressureLogEntry, 'id'>) => {
    const newEntry: PressureLogEntry = {
      ...entry,
      id: `p-${Date.now()}`,
    };
    setGarage((prev) => ({
      ...prev,
      [activeCarId]: {
        ...prev[activeCarId],
        pressureLogs: [newEntry, ...prev[activeCarId].pressureLogs].sort((a, b) =>
          b.date.localeCompare(a.date)
        ),
      },
    }));
  };

  const handleEditPressureLog = (id: string, entry: Omit<PressureLogEntry, 'id'>) => {
    setGarage((prev) => ({
      ...prev,
      [activeCarId]: {
        ...prev[activeCarId],
        pressureLogs: prev[activeCarId].pressureLogs
          .map((item) => (item.id === id ? { ...item, ...entry, id } : item))
          .sort((a, b) => b.date.localeCompare(a.date)),
      },
    }));
  };

  const handleDeletePressureLog = (id: string) => {
    setGarage((prev) => ({
      ...prev,
      [activeCarId]: {
        ...prev[activeCarId],
        pressureLogs: prev[activeCarId].pressureLogs.filter((item) => item.id !== id),
      },
    }));
  };

  const handleAddPurchase = (entry: Omit<PurchaseLogEntry, 'id'>) => {
    const newEntry: PurchaseLogEntry = {
      ...entry,
      id: `buy-${Date.now()}`,
    };
    setGarage((prev) => ({
      ...prev,
      [activeCarId]: {
        ...prev[activeCarId],
        purchaseLogs: [newEntry, ...prev[activeCarId].purchaseLogs].sort((a, b) =>
          b.date.localeCompare(a.date)
        ),
      },
    }));
  };

  const handleDeletePurchase = (id: string) => {
    setGarage((prev) => ({
      ...prev,
      [activeCarId]: {
        ...prev[activeCarId],
        purchaseLogs: prev[activeCarId].purchaseLogs.filter((item) => item.id !== id),
      },
    }));
  };

  const handleAddContact = (entry: Omit<TyreContact, 'id'>) => {
    setContacts((prev) => [{ ...entry, id: `contact-${Date.now()}` }, ...prev]);
  };

  const handleUpdateContact = (id: string, entry: Omit<TyreContact, 'id'>) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...entry } : c))
    );
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div
      className={
        activeTab === 'garage'
          ? 'h-dvh overflow-hidden bg-[#F3F4F2] text-[#111315] flex flex-col'
          : 'min-h-dvh bg-[#F3F4F2] text-[#111315] flex flex-col'
      }
    >
      {/* Top Bar: Left Add Purchase (on Purchases) · Centered clickable INFLATE · Top-Right Switch Cars */}
      <header className="shrink-0 z-20 bg-[#F3F4F2] border-b border-black/6">
        <div className="max-w-5xl mx-auto px-4 h-12 relative flex items-center justify-center">

          {activeTab === 'purchases' && (
            <button
              type="button"
              onClick={() => setAddPurchaseOpen(true)}
              aria-label="Add tyre purchase"
              title="Add tyre purchase"
              className="absolute left-3 w-10 h-10 rounded-full bg-[#111315] text-white shadow-[0_2px_8px_rgba(17,19,21,0.14)] hover:bg-black/85 active:scale-[0.96] transition-all flex items-center justify-center cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setLogExpanded(false);
              setActiveTab('garage');
            }}
            aria-label="Go to Home"
            className="font-brand text-sm sm:text-[15px] tracking-[0.42em] pl-[0.42em] uppercase text-[#111315] hover:opacity-70 active:scale-[0.98] transition-all cursor-pointer py-2"
          >
            INFLATE
          </button>

          <button
            type="button"
            onClick={handleSwapCar}
            aria-label={`Switch car to ${otherCar.displayTitle}`}
            title={`Switch to ${otherCar.displayTitle}`}
            className="absolute right-3 w-10 h-10 rounded-full bg-white border border-black/8 shadow-[0_2px_8px_rgba(17,19,21,0.04)] hover:bg-black/[0.02] active:scale-[0.96] transition-all flex items-center justify-center cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-[#111315]" />
          </button>
        </div>
      </header>

      {activeTab === 'purchases' ? (
        <main className="flex-1 flex flex-col w-full pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
          <PurchasesView
            car={carWithSortedLogs}
            contacts={contacts}
            addModalOpen={addPurchaseOpen}
            onCloseAddModal={() => setAddPurchaseOpen(false)}
            onAddPurchase={handleAddPurchase}
            onDeletePurchase={handleDeletePurchase}
            onAddContact={handleAddContact}
            onUpdateContact={handleUpdateContact}
            onDeleteContact={handleDeleteContact}
          />
        </main>
      ) : (
        /* Single-page zero-scroll Home layout */
        <main className="flex-1 min-h-0 max-w-5xl w-full mx-auto pt-2.5 pb-[calc(3.5rem+max(0.75rem,env(safe-area-inset-bottom)))] flex flex-col justify-between gap-2 lg:px-6 lg:grid lg:grid-cols-12 lg:gap-5 lg:py-4 lg:pb-20">
          {/* Top / Left Section: Vehicle Title + Last Top-Up + Bird's-Eye Image + FL/FR/RL/RR Boxes */}
          <section className="flex-1 min-h-0 px-4 lg:px-0 flex flex-col gap-2 lg:col-span-7">
            <div className="shrink-0 px-0.5 space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <h1 className="font-display text-xl sm:text-2xl font-medium tracking-tight text-[#111315] leading-tight">
                  {activeCar.displayTitle}
                </h1>
                {daysSinceLastTopUp !== null && (
                  <span className="font-display text-xl sm:text-2xl font-light tracking-tight text-[#5E646A] tabular-nums leading-tight shrink-0">
                    {daysSinceLastTopUp === 0
                      ? 'Today'
                      : daysSinceLastTopUp === 1
                        ? '1 day'
                        : `${daysSinceLastTopUp} days`}
                  </span>
                )}
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-[#5E646A] tabular-nums">
                  Last Top Up:{' '}
                  <span className="font-medium text-[#111315]">
                    {latestPressure ? formatDisplayDate(latestPressure.date) : '—'}
                  </span>
                </p>
                {selectedCorner && (
                  <span className="text-xs font-medium text-[#FF5A1F] shrink-0">
                    {CORNER_LABELS[selectedCorner]}
                  </span>
                )}
              </div>
            </div>

            {/* Bird's-Eye Car Image without box */}
            <div className="flex-1 min-h-[160px] max-h-[255px] lg:max-h-[360px] relative">
              <CarBirdsEyeView
                car={carWithSortedLogs}
                selectedCorner={selectedCorner}
                onSelectCorner={setSelectedCorner}
              />
            </div>

            {/* 4 Corner Boxes: FL, FR, RL, RR showing set kPa, PSI top-right, and age bottom-right */}
            <div className="shrink-0 grid grid-cols-2 gap-2">
              {TYRE_CORNERS.map((corner) => {
                const setKpa = activeCar.recommendedKpa[corner];
                const psiApprox = Math.round(setKpa * 0.145);
                const purchaseInfo = getCornerPurchaseInfo(activeCar.purchaseLogs, corner);
                const tyreAge = purchaseInfo ? formatTyreAge(purchaseInfo.date) : null;
                const isSelected = selectedCorner === corner;

                return (
                  <button
                    key={corner}
                    type="button"
                    onClick={() => setSelectedCorner(isSelected ? null : corner)}
                    className={`px-3 py-2 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#111315] text-white border-[#111315]'
                        : 'bg-white text-[#111315] border-black/7 hover:border-black/15'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 whitespace-nowrap">
                      <span
                        className={`font-mono text-xs font-semibold shrink-0 ${
                          isSelected ? 'text-[#FF5A1F]' : 'text-[#5E646A]'
                        }`}
                      >
                        {corner}
                      </span>
                      <span
                        className={`font-mono text-[10.5px] sm:text-[11px] tracking-tight tabular-nums whitespace-nowrap ${
                          isSelected ? 'text-white/70' : 'text-[#6B7075]'
                        }`}
                      >
                        {psiApprox} PSI
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-xl font-bold tabular-nums leading-none">
                          {setKpa}
                        </span>
                        <span
                          className={`text-[11px] font-mono ${
                            isSelected ? 'text-white/70' : 'text-[#5E646A]'
                          }`}
                        >
                          kPa
                        </span>
                      </div>
                      {tyreAge && (
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                            isSelected ? 'text-white/80' : 'text-[#5E646A]'
                          }`}
                        >
                          {tyreAge}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Full-Width Bottom Pressure Log Bar with Curved Top Left & Right Edges */}
          <div className="shrink-0 w-full lg:col-span-5 lg:self-start">
            <PressureLogSheet
              car={carWithSortedLogs}
              expanded={logExpanded}
              onToggleExpanded={setLogExpanded}
              onAddLog={handleAddPressureLog}
              onEditLog={handleEditPressureLog}
              onDeleteLog={handleDeletePressureLog}
            />
          </div>
        </main>
      )}

      {/* Sticky Bottom Navigation Bar: Home (Left) · Purchases (Middle) · Log (Right) */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setLogExpanded(false);
          setActiveTab(tab);
        }}
        onOpenLog={() => {
          setLogExpanded(false);
          setLogModalOpen(true);
        }}
      />

      {/* Quick Log Modal (Date + Location) */}
      <QuickLogModal
        open={logModalOpen}
        car={carWithSortedLogs}
        onClose={() => setLogModalOpen(false)}
        onLogCreated={handleAddPressureLog}
      />
    </div>
  );
}
